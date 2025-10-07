# Solana Sync Functions

Functions that synchronize on-chain Solana state with the Supabase database and execute protocol operations on Solana smart contracts.

---

## /solana/sync-pool

**Current Implementation:** [supabase/functions/solana-sync-pool/index.ts](../../supabase/functions/solana-sync-pool/index.ts)

Fetches current token supply and USDC reserve balance from a ContentPool on-chain and updates the database.

### Request Parameters

```typescript
{
  post_id: string    // UUID of the post
  pool_address: string  // Base58 Solana address of ContentPool
}
```

### Response

**Success (200):**
```typescript
{
  token_supply: string     // Current token supply (as string to handle large numbers)
  reserve: string          // Current USDC reserve in atomic units (micro-USDC)
  synced_at: string        // ISO timestamp of sync
}
```

**Error (400):**
```typescript
{
  error: "Missing required fields"
}
```

**Error (404):**
```typescript
{
  error: "Pool account not found: <details>"
}
```

**Error (500):**
```typescript
{
  error: "Failed to update database: <details>" | "Internal server error"
}
```

### Process

1. Validate `post_id` and `pool_address` are provided
2. Initialize Solana RPC connection
   - Uses `SOLANA_RPC_ENDPOINT` env var (default: `http://127.0.0.1:8899`)
   - Converts `localhost`/`127.0.0.1` to `host.docker.internal` for Docker compatibility
3. Call shared `syncPoolData()` utility ([_shared/pool-sync.ts](../../supabase/functions/_shared/pool-sync.ts))
4. Return synced pool data

### Shared Utility: syncPoolData()

**Location:** [supabase/functions/_shared/pool-sync.ts](../../supabase/functions/_shared/pool-sync.ts)

Type-safe pool data fetching using Anchor IDL deserialization.

**Implementation:**
- Creates Anchor provider with dummy wallet (read-only)
- Initializes Program from IDL with `SOLANA_PROGRAM_ID`
- Fetches ContentPool account using `program.account.contentPool.fetch()`
- Extracts `tokenSupply` and `reserve` as `anchor.BN` types
- Updates `pool_deployments` table:
  - `token_supply`: token supply as string
  - `reserve`: reserve balance as string
  - `last_synced_at`: current timestamp

**Benefits:**
- Uses Anchor IDL for automatic struct deserialization
- No hardcoded byte offsets (robust to struct changes)
- Type-safe field access

### When Called

- After pool deployment to get initial state
- Periodically from [app-post-get-feed](../../supabase/functions/app-post-get-feed/index.ts) (every 30 seconds)
- On-demand when displaying pool data in UI
- After buy/sell transactions to refresh pool state

### Environment Variables

- `SOLANA_RPC_ENDPOINT`: Solana RPC URL (required)
- `SOLANA_PROGRAM_ID`: veritas-curation program ID (required)
- `SUPABASE_URL`: Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY`: For database updates (required)

### Error Handling

- Missing parameters → 400 Bad Request
- Pool account not found on-chain → 404 Not Found
- Database update failure → 500 Internal Server Error
- Connection errors → 500 with error details

### Performance

- **Latency:** ~100-300ms (RPC call + DB update)
- **Rate limits:** Subject to Solana RPC rate limits
- **Caching:** None (always fetches fresh on-chain data)

---

## /solana/sync-stake-from-chain

**Current Implementation:** [supabase/functions/sync-stake-from-chain/index.ts](../../supabase/functions/sync-stake-from-chain/index.ts)

Reads a user's on-chain VeritasCustodian balance and updates their stake in the database.

### Request Parameters

```typescript
{
  agent_id: string        // UUID of protocol agent
  solana_address: string  // User's Solana wallet address (base58)
}
```

### Response

**Success (200):**
```typescript
{
  success: true
  agent_id: string
  solana_address: string
  custodian_pda: string           // Derived custodian account address
  balance_usdc: number            // Current balance (USDC, not micro-USDC)
  total_deposited_usdc: number    // Lifetime deposits
  total_withdrawn_usdc: number    // Lifetime withdrawals
  synced_at: string               // ISO timestamp
}
```

**Error (400):**
```typescript
{
  error: "Missing agent_id or solana_address"
}
```

**Error (404):**
```typescript
{
  error: "Custodian account not found on-chain"
  message: "User needs to initialize custodian first"
}
```

**Error (500):**
```typescript
{
  error: "Database update failed" | "Internal server error"
  details?: any
}
```

### Process

1. Validate `agent_id` and `solana_address`
2. Initialize Solana connection with `SOLANA_RPC_ENDPOINT`
3. Derive custodian PDA:
   ```typescript
   seeds = ["custodian", owner_pubkey]
   pda = PublicKey.findProgramAddressSync(seeds, program_id)
   ```
4. Fetch custodian account from chain
5. Parse account data (with discriminator offset):
   - **Struct layout:** `owner (32) + protocol_authority (32) + usdc_vault (32) + total_deposited (8) + total_withdrawn (8) + is_paused (1) + bump (1)`
   - **Offsets:** `total_deposited` at byte 104, `total_withdrawn` at byte 112
6. Calculate balance: `balance = total_deposited - total_withdrawn`
7. Call database function `sync_agent_stake_from_chain()`
8. Update `agents` table with `total_deposited` and `total_withdrawn`

### Database Function Called

```sql
sync_agent_stake_from_chain(
  p_agent_id: UUID,
  p_solana_address: TEXT,
  p_onchain_balance: NUMERIC  -- in USDC (not micro-USDC)
)
```

Updates agent's current stake to match on-chain balance.

### When Called

- After user deposits USDC to custodian
- After user withdraws USDC from custodian
- Periodically to reconcile off-chain balance with on-chain state
- On user login to refresh stake balance

### Environment Variables

- `SOLANA_RPC_ENDPOINT`: Solana RPC URL (default: `https://api.devnet.solana.com`)
- `SOLANA_PROGRAM_ID`: veritas-curation program ID (required)
- `SUPABASE_URL`: Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY`: For database updates (required)

### Error Handling

- Missing parameters → 400
- Custodian not initialized → 404 with helpful message
- Database function error → 500 with details
- Parse errors → 500

### Performance

- **Latency:** ~150-400ms (RPC call + DB update)
- **Rate limits:** Subject to Solana RPC limits
- **Caching:** None (real-time sync)

### Security Notes

- Uses **SERVICE_ROLE_KEY** (not ANON_KEY) for privileged database access
- No authentication on endpoint (should add Privy JWT validation in future)
- Reads on-chain data only (no signing operations)

---

## /solana/update-pool-deployment

**Current Implementation:** [supabase/functions/update-pool-deployment/index.ts](../../supabase/functions/update-pool-deployment/index.ts)

Confirms a pool deployment by recording the transaction signature. Used after pool creation to mark the deployment as confirmed.

### Request Parameters

```typescript
{
  pool_address: string   // Base58 Solana address of ContentPool
  tx_signature: string   // Base58 transaction signature
}
```

### Response

**Success (200):**
```typescript
{
  success: true
  pool_address: string
  tx_signature: string
  confirmed_at: string  // ISO timestamp
}
```

**Error (422):**
```typescript
{
  error: "Missing required fields: pool_address, tx_signature"
  code: 422
}
// OR
{
  error: "Invalid pool_address format (must be base58)"
  code: 422
}
// OR
{
  error: "Invalid tx_signature format (must be base58)"
  code: 422
}
```

**Error (404):**
```typescript
{
  error: "Pool deployment not found"
  code: 404
}
```

**Error (409):**
```typescript
{
  error: "Pool deployment already confirmed"
  code: 409
  existing_signature: string
}
```

**Error (503):**
```typescript
{
  error: "Failed to update pool deployment"
  code: 503
}
```

### Process

1. Validate required fields present
2. Validate base58 format (regex: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`)
3. Check pool deployment exists in database
4. Check deployment not already confirmed (no existing tx signature)
5. Update `pool_deployments` table:
   - Set `deployment_tx_signature`
   - Set `last_synced_at` to current timestamp
6. Return success

### When Called

- After successfully deploying a ContentPool on-chain
- Called by frontend after transaction confirmation
- Part of pool creation flow

### Authentication

- Uses `SUPABASE_ANON_KEY` (public endpoint)
- Should validate user owns the post in future

### Environment Variables

- `SUPABASE_URL`: Supabase project URL (required)
- `SUPABASE_ANON_KEY`: For public database access (required)

### Error Handling

- Validates base58 format to prevent injection
- Idempotent check (409 if already confirmed)
- Returns specific error codes for different failure modes

### Performance

- **Latency:** ~50-100ms (database query + update)
- **No RPC calls** (purely database operation)

---

## /solana/pool-redistribution

**Current Implementation:** [supabase/functions/pool-redistribution/index.ts](../../supabase/functions/pool-redistribution/index.ts)

**⚠️ SERVICE_ROLE ONLY - Not callable by users**

Executes pool penalty/reward redistribution based on epoch outcomes. This is the core economic mechanism of Veritas.

### Request Parameters

None (triggered by epoch cron job)

### Response

**Success (200):**
```typescript
{
  success: true
  penalties: number              // Number of penalties applied
  rewards: number                // Number of rewards distributed
  penaltyPot: number             // Total penalty pot size (USDC)
  totalTransactions: number      // Total on-chain transactions
  failedPenalties: Array<{
    pool: string
    error: string
  }>
  failedRewards: Array<{
    pool: string
    error: string
  }>
  penaltySignatures: string[]    // Transaction signatures for penalties
  rewardSignatures: string[]     // Transaction signatures for rewards
}
```

**Skipped (200):**
```typescript
{
  success: true
  message: "Solana not configured" | "No pools to process" | "No valid pools to process"
  penalties: 0
  rewards: 0
}
```

**Error (500):**
```typescript
{
  error: "Pool redistribution failed"
  message: string
  code: 500
}
```

### Process

#### Phase 0: Setup & Validation

1. Check `SOLANA_PROGRAM_ID` configured (skip if not)
2. Load protocol authority keypair from `SOLANA_AUTHORITY_SECRET_KEY`
3. Initialize Anchor program with IDL
4. Derive treasury PDA: `["treasury"]`
5. Derive treasury USDC vault PDA: `["treasury-vault"]`

#### Phase 1: Data Collection

6. Fetch all confirmed pools with `delta_relevance` and `certainty`:
   ```sql
   SELECT pool_address, usdc_vault_address, reserve, belief_id,
          beliefs.delta_relevance, beliefs.certainty
   FROM pool_deployments
   INNER JOIN beliefs ON pool_deployments.belief_id = beliefs.id
   WHERE deployment_tx_signature IS NOT NULL
   ```

7. Validate pool data:
   - `delta_relevance` present and in range [-1, 1]
   - `certainty` present and in range [0, 1]
   - `reserve` ≥ 0
   - Skip invalid pools with warning logs

#### Phase 2: Penalty Calculation

8. Fetch config values from `system_config` table:
   - `base_skim_rate` (default: 0.01 = 1%)
   - `epoch_rollover_balance` (accumulated from previous epochs)

9. Calculate penalty rates:
   ```typescript
   if (deltaR < 0) {
     penalty_rate = min(abs(deltaR) * certainty, 0.10)  // Max 10%
   } else if (deltaR === 0) {
     penalty_rate = base_skim_rate  // Default 1%
   } else {
     penalty_rate = 0  // No penalty for positive impact
   }
   ```

10. Accumulate penalty pot:
    ```typescript
    penalty_pot = epoch_rollover_balance
    for each pool:
      penalty_amount = reserve * penalty_rate
      penalty_pot += penalty_amount
    ```

#### Phase 3: Reward Distribution

11. Calculate positive impact (probability simplex):
    ```typescript
    positive_pools = pools.filter(p => p.deltaR > 0)
    for each positive pool:
      impact = deltaR * certainty
    total_positive_impact = sum(all impacts)
    ```

12. Distribute rewards proportionally:
    ```typescript
    if (total_positive_impact > 0) {
      for each positive pool:
        reward = (penalty_pot * pool.impact) / total_positive_impact
      // Reset epoch_rollover_balance to 0
    } else {
      // No winners, rollover penalty_pot to next epoch
      // Update epoch_rollover_balance to penalty_pot
    }
    ```

#### Phase 4: Update Database FIRST (Idempotent)

13. **CRITICAL:** Update `system_config.epoch_rollover_balance` BEFORE on-chain transactions
    - Prevents double-spending if function retries
    - Reset to 0 if rewards distributed
    - Update to new penalty_pot if rolling over

#### Phase 5: Apply Penalties On-Chain

14. For each pool with penalty > 0:
    ```typescript
    await program.methods
      .applyPoolPenalty(penalty_lamports)
      .accounts({
        pool: pool_pubkey,
        treasury: treasury_pda,
        poolUsdcVault: pool_usdc_vault,
        treasuryUsdcVault: treasury_usdc_vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        authority: authority_keypair.publicKey
      })
      .signers([authority_keypair])
      .rpc()
    ```
    - Transfers USDC from pool vault to treasury vault
    - Updates pool reserve on-chain
    - Logs success/failure for each pool

#### Phase 6: Apply Rewards On-Chain

15. For each pool with reward > 0:
    ```typescript
    await program.methods
      .applyPoolReward(reward_lamports)
      .accounts({
        pool: pool_pubkey,
        treasury: treasury_pda,
        treasuryUsdcVault: treasury_usdc_vault,
        poolUsdcVault: pool_usdc_vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        authority: authority_keypair.publicKey
      })
      .signers([authority_keypair])
      .rpc()
    ```
    - Transfers USDC from treasury vault to pool vault
    - Updates pool reserve on-chain
    - Logs success/failure for each pool

### When Called

- **Automated:** Called by epoch cron job after belief aggregation completes
- **Manual:** Can be triggered by admin for testing/recovery
- **Frequency:** Once per epoch (currently ~1 hour)

### Solana Instructions Used

- `apply_pool_penalty(amount: u64)` - Transfer from pool to treasury
- `apply_pool_reward(amount: u64)` - Transfer from treasury to pool

### Environment Variables

- `SOLANA_RPC_ENDPOINT`: Solana RPC URL (required)
- `SOLANA_PROGRAM_ID`: veritas-curation program ID (required)
- `SOLANA_AUTHORITY_SECRET_KEY`: Protocol authority keypair JSON array (required, sensitive)
- `SUPABASE_URL`: Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY`: For database access (required)

### Error Handling

- Missing `SOLANA_PROGRAM_ID` → Skip gracefully (200 with message)
- Missing `SOLANA_AUTHORITY_SECRET_KEY` → Throw error (500)
- No pools to process → Skip gracefully (200 with message)
- Invalid pool data → Skip pool with warning, continue
- Failed penalty/reward transaction → Log error, track in response, continue
- Database update failure → Throw error (prevents double-spending)

### Performance

- **Latency:** ~2-10 seconds (depends on number of pools)
- **Transactions:** 2 per pool (1 penalty + 1 reward) in worst case
- **Cost:** ~0.000005 SOL per transaction (~$0.0001 at $20 SOL)
- **Bottleneck:** RPC rate limits on mainnet

### Security & Safety

- **SERVICE_ROLE_KEY required** (not callable by users)
- **Authority keypair required** (only protocol authority can execute)
- **Idempotent:** Database updated BEFORE on-chain operations
- **Retry-safe:** Failed transactions logged, can be manually retried
- **Validation:** All pool data validated before calculations
- **Constraints:** Max 10% penalty per pool prevents catastrophic losses
- **Two-phase:** Penalties applied before rewards (treasury fills first)

### Economic Properties

- **Conservation:** Total USDC in system remains constant (penalties = rewards + rollover)
- **Incentive alignment:** Positive delta_relevance pools rewarded, negative penalized
- **Certainty weighting:** Higher certainty = larger penalties/rewards
- **Base skim:** Neutral pools pay small fee to prevent gaming
- **Rollover:** Penalty pot carries forward if no positive pools exist

---

## Configuration

All Solana sync functions require consistent environment variables:

### Required Variables

```bash
# Solana Network
SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899  # or mainnet/devnet
SOLANA_PROGRAM_ID=<veritas-curation-program-id>

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>               # For public endpoints
SUPABASE_SERVICE_ROLE_KEY=<service-key>    # For privileged operations

# Protocol Authority (pool-redistribution only)
SOLANA_AUTHORITY_SECRET_KEY=[1,2,3,...]    # JSON array of secret key bytes
```

### Network-Specific Config

See [src/lib/config/network-config.ts](../../src/lib/config/network-config.ts) for:
- USDC mint addresses per network
- RPC endpoints
- Program IDs per environment

---

## Testing

### Local Testing

1. Start local Solana test validator
2. Deploy veritas-curation program
3. Set environment variables in `.env.local`
4. Run Supabase locally: `supabase start`
5. Deploy functions: `supabase functions deploy <function-name>`

### Test Scenarios

**sync-pool:**
- ✅ Valid pool address → Returns pool data
- ✅ Invalid pool address → 400 error
- ✅ Non-existent pool → 404 error
- ✅ Database unavailable → 500 error

**sync-stake-from-chain:**
- ✅ Initialized custodian → Returns balance
- ✅ Uninitialized custodian → 404 with message
- ✅ Invalid solana_address → 500 parse error
- ✅ Database sync success → Updates agent stake

**update-pool-deployment:**
- ✅ Valid tx signature → Confirms deployment
- ✅ Already confirmed → 409 conflict
- ✅ Non-existent pool → 404
- ✅ Invalid base58 → 422

**pool-redistribution:**
- ✅ No pools → Graceful skip
- ✅ All positive delta_relevance → Distribute all penalties
- ✅ All negative delta_relevance → Rollover entire pot
- ✅ Mixed results → Apply penalties and rewards
- ✅ Failed transaction → Log and continue
- ✅ No authority key → 500 error

---

## Future Improvements

### sync-pool & sync-stake-from-chain
- [ ] Add authentication (Privy JWT validation)
- [ ] Implement response caching (5-30 second TTL)
- [ ] Batch sync multiple pools in single request
- [ ] Add WebSocket support for real-time updates

### update-pool-deployment
- [ ] Verify user owns the post before updating
- [ ] Fetch transaction from RPC to validate it exists
- [ ] Add retry logic for RPC verification

### pool-redistribution
- [ ] Implement transaction batching (versioned transactions)
- [ ] Add dry-run mode for testing calculations
- [ ] Create admin dashboard for monitoring
- [ ] Add alerting for failed transactions
- [ ] Implement automatic retry with exponential backoff
- [ ] Add circuit breaker for repeated failures
- [ ] Store transaction history in database
- [ ] Add metrics/observability (Datadog, etc.)

### General
- [ ] Add OpenAPI/Swagger documentation
- [ ] Implement rate limiting per user
- [ ] Add request tracing/correlation IDs
- [ ] Create integration test suite
- [ ] Add performance benchmarks
- [ ] Document deployment process

---

## Related Documentation

- [Solana Architecture Spec](../solana-specs/solana_architecture_spec.md) - Smart contract details
- [Protocol Tables](../data-structures/01-protocol-tables.md) - Database schema
- [App Functions](./02-app-functions.md) - Higher-level app operations
- [Epoch Cron Management](./03-epoch-cron-management.md) - Scheduling details

---

**Last Updated:** October 7, 2025
