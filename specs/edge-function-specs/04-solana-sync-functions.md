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

## /pool-settlement

**Current Implementation:** [supabase/functions/pool-settlement/index.ts](../../supabase/functions/pool-settlement/index.ts)

**⚠️ SERVICE_ROLE ONLY - Not callable by users**

Settles individual pools based on BD (Belief Decomposition) relevance scores. Each pool settles independently against absolute BD scores - no cross-pool redistribution.

### Request Parameters

```typescript
{
  epoch: number              // Epoch to settle
  pool_addresses?: string[]  // Optional: specific pools to settle (default: all)
}
```

### Response

**Success (200):**
```typescript
{
  success: true
  epoch: number
  settled_count: number
  failed_count: number
  settlements: Array<{
    pool_address: string
    belief_id: string
    bd_score: number          // BD relevance score x ∈ [0,1]
    market_prediction_q: number  // q = R_long / (R_long + R_short)
    f_long: number            // Settlement factor: x / q
    f_short: number           // Settlement factor: (1-x) / (1-q)
    tx_signature: string
  }>
  errors: Array<{
    pool_address: string
    error: string
  }>
}
```

### Process

1. **Fetch pools to settle:**
   - Query pools with associated beliefs
   - Filter for pools with BD scores calculated this epoch

2. **For each pool:**
   - Fetch BD relevance score `x ∈ [0,1]` from belief
   - Read on-chain pool state (R_long, R_short)
   - Calculate market prediction `q = R_long / (R_long + R_short)`
   - Compute settlement factors:
     - `f_long = x / q` (if q ≠ 0)
     - `f_short = (1-x) / (1-q)` (if q ≠ 1)
   - Build `settle_epoch` transaction
   - Execute with protocol authority signature
   - Record settlement in `settlements` table

3. **Settlement Mechanics:**
   - New reserves: `R_long' = R_long × f_long`, `R_short' = R_short × f_short`
   - If `x > q`: LONG gains, SHORT loses (market underestimated)
   - If `x < q`: SHORT gains, LONG loses (market overestimated)
   - If `x = q`: No change (perfect prediction)

### Key Differences from Old Design

**Old (Cross-Pool Redistribution):**
- Pools competed for share of penalty pot
- Used delta_relevance (change from previous epoch)
- Required ProtocolTreasury to shuttle USDC
- Complex winner/loser calculations

**New (Independent Settlement):**
- Each pool settles independently
- Uses absolute BD score `x ∈ [0,1]`
- No cross-pool dependencies
- Simpler: just scale reserves by accuracy factors

### When Called

- Triggered by `/protocol/epochs/process` after BD scoring completes
- Typically once per epoch for all active pools
- Can be retried for individual pools if needed

### Environment Variables

- `SOLANA_RPC_URL` - Solana RPC endpoint
- `SOLANA_AUTHORITY_SECRET_KEY` - Protocol authority keypair
- `VERITAS_CURATION_PROGRAM_ID` - ContentPool program ID

### Related Documentation

- [Pool Settlement Service Spec](../../solana-specs/pool-settlement-service.md) - Detailed implementation
- [ContentPool Settlement](../../solana-specs/smart-contracts/ContentPool.md#settle_epoch) - On-chain instruction
- [Epoch Processing Chain](../EPOCH_PROCESSING_CHAIN.md#pool-settlement) - How it fits in epoch flow

---

## /update-pool-mints

**Current Implementation:** [supabase/functions/update-pool-mints/index.ts](../../supabase/functions/update-pool-mints/index.ts)

**⚠️ SERVICE_ROLE ONLY - Not callable by users**

Updates pool_deployments table with LONG and SHORT mint addresses after market deployment.

### Request Parameters

```typescript
{
  pool_address: string       // ContentPool address
  long_mint: string          // LONG token mint address
  short_mint: string         // SHORT token mint address
}
```

### Response

**Success (200):**
```typescript
{
  success: true
  pool_address: string
  long_mint: string
  short_mint: string
}
```

### Process

1. Validate pool exists in `pool_deployments` table
2. Update `long_mint_address` and `short_mint_address` columns
3. Set `market_deployed_at` timestamp
4. Return confirmation

### When Called

- Called automatically after `deploy_market` transaction confirms
- Triggered by event indexer when MarketDeployed event detected
- Can be called manually for reconciliation

### Environment Variables

None required (database operation only)

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
