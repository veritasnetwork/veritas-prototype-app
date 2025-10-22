# Pool API Architecture Specification

**Version**: 2.1 (Single-Transaction Atomic Deployment)
**Last Updated**: October 2025
**Architecture**: Next.js API Routes + Client-Side SDK

---

## High-Level Overview

### Architecture Philosophy

The pool deployment system follows a **client-side transaction building** pattern where:

1. **API Routes** handle authentication, validation, and database operations
2. **SDK** (`@/lib/solana/sdk/transaction-builders.ts`) builds unsigned transactions
3. **Client** (React components/hooks) signs transactions via Privy wallet
4. **Solana RPC** receives signed transactions directly from client

This architecture eliminates server-side Anchor complexity and provides better UX through client-side wallet signing.

### Single-Transaction Deployment Flow

Pool deployment happens in **one atomic transaction** containing two instructions:

**Instruction 1: `create_pool`**
- Creates empty `ContentPool` account on Solana
- Creates `PoolRegistry` for tracking
- Sets ICBS parameters (F, β, λ)

**Instruction 2: `deploy_market`**
- Creates LONG and SHORT token mints
- Creates USDC vault
- Deposits initial liquidity
- Mints initial tokens to deployer
- Pool becomes immediately tradeable

**User Experience**: Sign once → Pool fully deployed with liquidity

### Component Separation

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│  - React Components (DeployPoolCard)                    │
│  - Hooks (useDeployPool, usePoolAddresses)             │
│  - Wallet Integration (Privy)                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─► SDK (Transaction Builders)
                 │   - buildCreatePoolTx()
                 │   - buildDeployMarketTx()
                 │   - buildTradeTx()
                 │   - derivePoolAddresses()
                 │
                 ├─► Next.js API Routes
                 │   - POST /api/pools/deploy (validation)
                 │   - POST /api/pools/record (DB recording)
                 │
                 └─► Solana RPC
                     - Transaction submission
                     - Confirmation polling
```

---

## API Endpoints

### 1. POST `/api/pools/deploy`

**Purpose**: Validate pool deployment request

**Authentication**: Required (Privy JWT)

**Request Body**:
```typescript
{
  postId: string  // UUID of post
}
```

**Response (200)**:
```typescript
{
  success: true
  postId: string
  userId: string
}
```

**Response (409 - Conflict)**:
```typescript
{
  error: "Pool already deployed for this post"
  existingPoolAddress: string
}
```

**Validation Logic**:
1. Authenticate user via Privy
2. Verify post exists and user owns it
3. Check if pool already deployed (duplicate prevention)
4. Return success (client proceeds with SDK)

**No Solana Operations**: All PDA derivation happens client-side

---

### 2. POST `/api/pools/record`

**Purpose**: Record successful deployment in database (post-confirmation)

**Authentication**: Required (Privy JWT)

**Request Body**:
```typescript
{
  postId: string
  poolAddress: string
  signature: string          // Combined transaction signature
  initialDeposit: number     // USDC amount
  longAllocation: number     // USDC allocated to LONG side (in lamports)
}
```

**Response (200)**:
```typescript
{
  success: true
  recordId: string  // pool_deployments.id
}
```

**Database Operations**:

- INSERT into `pool_deployments` with complete state:
  ```sql
  INSERT INTO pool_deployments (
    post_id,
    belief_id,
    pool_address,
    deployed_by_agent_id,
    deployment_tx_signature,
    market_deployment_tx_signature,  -- Same as deployment_tx (combined tx)
    deployed_at,
    market_deployed_at,
    initial_usdc,
    initial_long_allocation,
    initial_short_allocation,
    s_long_supply,
    s_short_supply,
    vault_balance,
    long_mint_address,
    short_mint_address,
    f,
    beta_num,
    beta_den,
    sqrt_lambda_long_x96,
    sqrt_lambda_short_x96,
    sqrt_price_long_x96,
    sqrt_price_short_x96,
    status,
    last_synced_at
  ) VALUES (...)
  ```

**Idempotency**: Checks if pool already exists before inserting

---

## Client-Side SDK

### Location
`/src/lib/solana/sdk/transaction-builders.ts`

### Core Functions

#### `buildCreatePoolTx()`
```typescript
export async function buildCreatePoolTx(
  program: Program<VeritasCuration>,
  creator: PublicKey,
  contentId: Buffer,  // UUID converted to 32-byte buffer
  params: {
    f?: number;       // Optional ICBS growth exponent
    betaNum?: number;  // Optional beta numerator
    betaDen?: number;  // Optional beta denominator
  },
  addresses: ProtocolAddresses
): Promise<Transaction>
```

**Returns**: Unsigned transaction for `PoolFactory::create_pool` instruction

**Accounts Required**:
- `factory` - PoolFactory PDA
- `pool` - ContentPool PDA (derived from content_id)
- `registry` - PoolRegistry PDA
- `custodian` - Global custodian PDA
- `creator` - Signer
- `payer` - Signer (usually same as creator)
- `protocolAuthority` - Pool authority from factory
- `systemProgram` - System program

---

#### `buildDeployMarketTx()`
```typescript
export async function buildDeployMarketTx(
  program: Program<VeritasCuration>,
  deployer: PublicKey,
  contentId: PublicKey,
  params: {
    initialDeposit: BN;    // USDC amount in lamports
    longAllocation: BN;    // USDC allocated to LONG
    usdcMint: PublicKey;
  }
): Promise<Transaction>
```

**Returns**: Unsigned transaction for `ContentPool::deploy_market` instruction

**Accounts Required**:
- `pool` - ContentPool PDA
- `longMint` - LONG token mint PDA (to be created)
- `shortMint` - SHORT token mint PDA (to be created)
- `vault` - USDC vault PDA (to be created)
- `deployerUsdc` - Deployer's USDC ATA
- `deployerLong` - Deployer's LONG token ATA (created if needed)
- `deployerShort` - Deployer's SHORT token ATA (created if needed)
- `usdcMint` - USDC mint address
- `deployer` - Signer
- `payer` - Signer (usually same as deployer)
- `tokenProgram` - SPL Token program
- `associatedTokenProgram` - Associated Token program
- `systemProgram` - System program

---

#### `derivePoolAddresses()`
```typescript
export function derivePoolAddresses(
  postId: string,  // UUID
  programId: PublicKey
): {
  contentId: string;
  pool: string;
  registry: string;
  factory: string;
  custodian: string;
  longMint: string;
  shortMint: string;
  vault: string;
}
```

**Purpose**: Client-side PDA derivation without API calls

**Used By**: Components to display addresses, hooks to build transactions

---

#### `uuidToContentId()`
```typescript
export function uuidToContentId(postId: string): PublicKey
```

**Purpose**: Convert UUID to 32-byte PublicKey for Solana

**Algorithm**:
1. Remove hyphens from UUID
2. Convert hex string to 16-byte buffer
3. Pad to 32 bytes (zeros fill remaining)
4. Create PublicKey from buffer

---

### PDA Seed Patterns

All PDAs use standard Anchor seeds:

| Account | Seeds | Program |
|---------|-------|---------|
| ContentPool | `[b"content_pool", content_id]` | veritas_curation |
| PoolRegistry | `[b"pool_registry", content_id]` | veritas_curation |
| LONG Mint | `[b"long_mint", content_id]` | veritas_curation |
| SHORT Mint | `[b"short_mint", content_id]` | veritas_curation |
| Vault | `[b"vault", content_id]` | veritas_curation |
| PoolFactory | `[b"factory"]` | veritas_curation |
| Custodian | `[b"custodian"]` | veritas_curation |

**Note**: `content_id` is the 32-byte PublicKey derived from UUID

---

## Client-Side Hooks

### `useDeployPool()`

**Location**: `/src/hooks/useDeployPool.ts`

**Purpose**: Orchestrates 2-phase pool deployment

**API**:
```typescript
const { deployPool, isDeploying, error } = useDeployPool();

const result = await deployPool({
  postId: string;
  initialDeposit: number;  // USDC
  longAllocationPercent: number;  // 0-100
});

// Returns:
{
  poolAddress: string;
  signature: string;  // Single combined transaction
}
```

**Flow**:
1. Call `/api/pools/deploy` for validation
2. Derive PDAs client-side
3. Fetch PoolFactory to get pool authority
4. Build `create_pool` instruction
5. Build `deploy_market` instruction
6. Combine both into ONE transaction
7. Sign ONCE with Privy wallet
8. Send to Solana RPC
9. Confirm transaction
10. Record deployment via `/api/pools/record`

**Error Handling**:
- User rejection → "Transaction cancelled"
- Insufficient funds → Solana error passed through
- Network issues → Retry/timeout logic
- Validation failures → API error message

---

### `usePoolAddresses()`

**Location**: `/src/hooks/usePoolAddresses.ts`

**Purpose**: Memoized client-side PDA derivation

**API**:
```typescript
const addresses = usePoolAddresses(postId);

// Returns (or null if postId is null):
{
  contentId: string;
  pool: string;
  registry: string;
  factory: string;
  custodian: string;
  longMint: string;
  shortMint: string;
  vault: string;
}
```

**Use Cases**:
- Display pool address before deployment
- Show token mint addresses
- Pre-calculate addresses for UI

---

## Database Schema

### `pool_deployments` Table

```sql
CREATE TABLE pool_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Solana addresses
    pool_address TEXT NOT NULL UNIQUE,
    long_mint_address TEXT,
    short_mint_address TEXT,
    vault_balance NUMERIC,

    -- Deployment info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    market_deployed_at TIMESTAMPTZ,
    deployed_by_agent_id UUID REFERENCES agents(id),
    deployment_tx_signature TEXT,
    market_deployment_tx_signature TEXT,  -- Same as deployment_tx (combined tx)

    -- ICBS parameters (cached from chain)
    f INTEGER DEFAULT 1,
    beta_num INTEGER DEFAULT 1,
    beta_den INTEGER DEFAULT 2,
    sqrt_lambda_long_x96 TEXT,
    sqrt_lambda_short_x96 TEXT,

    -- Initial state
    initial_long_allocation NUMERIC,
    initial_short_allocation NUMERIC,
    initial_usdc NUMERIC,

    -- Current state (synced from chain)
    s_long_supply NUMERIC,  -- Token supply for LONG side
    s_short_supply NUMERIC,  -- Token supply for SHORT side
    r_long NUMERIC,  -- Virtual reserve for LONG: R_L = s_L × p_L
    r_short NUMERIC,  -- Virtual reserve for SHORT: R_S = s_S × p_S
    sqrt_price_long_x96 TEXT,
    sqrt_price_short_x96 TEXT,
    status TEXT CHECK (status IN ('pool_created', 'market_deployed', 'failed')),
    last_synced_at TIMESTAMPTZ,

    -- Settlement tracking
    last_settlement_epoch INTEGER,
    last_settlement_tx TEXT
);
```

**Lifecycle**:
1. Single INSERT creates complete record with all deployment data
2. Ongoing: Pool state sync updates current values (`s_long`, `s_short`, prices)

---

## Environment Variables

### Next.js (Client + API Routes)

```bash
# Solana Configuration
NEXT_PUBLIC_VERITAS_PROGRAM_ID=<program_id>
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_USDC_MINT=<usdc_mint>
NEXT_PUBLIC_FACTORY_ADDRESS=<factory_pda>
NEXT_PUBLIC_CUSTODIAN_ADDRESS=<custodian_pda>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=<privy_app_id>
PRIVY_APP_SECRET=<privy_secret>
```

**Note**: No edge function configuration needed (deprecated)

---

## Error Handling

### API Route Errors

| Status | Error | Cause | Resolution |
|--------|-------|-------|------------|
| 401 | Invalid or missing authentication | No Privy JWT | User must log in |
| 403 | Not authorized | User doesn't own post | Check ownership |
| 404 | Post not found | Invalid post_id | Verify post exists |
| 404 | User not found | Privy user not in DB | Complete onboarding |
| 409 | Pool already deployed | Duplicate deployment | Use existing pool |
| 500 | Internal server error | DB or unexpected error | Check logs |

### Transaction Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| User rejected transaction | Wallet cancellation | Prompt retry |
| Insufficient funds | Not enough USDC | Request deposit |
| Account already exists | Duplicate pool | Skip Phase 1 |
| Market already deployed | Duplicate market | Pool already live |
| Simulation failed | Invalid params | Check amounts/ratios |

---

## Testing Checklist

### API Routes
- [ ] `/api/pools/deploy` validates auth
- [ ] `/api/pools/deploy` prevents duplicate pools
- [ ] `/api/pools/deploy` checks post ownership
- [ ] `/api/pools/deploy-market` validates pool exists
- [ ] `/api/pools/record` inserts Phase 1 correctly
- [ ] `/api/pools/record` updates Phase 2 correctly
- [ ] `/api/pools/record` handles duplicate inserts

### SDK Functions
- [ ] `buildCreatePoolTx()` builds valid transaction
- [ ] `buildDeployMarketTx()` builds valid transaction
- [ ] `derivePoolAddresses()` matches on-chain PDAs
- [ ] `uuidToContentId()` produces correct 32-byte key
- [ ] Transaction signing works with Privy wallet
- [ ] Transactions confirm on devnet/localnet

### Hooks
- [ ] `useDeployPool()` completes 2-phase deployment
- [ ] `useDeployPool()` handles user cancellation
- [ ] `useDeployPool()` records both phases in DB
- [ ] `usePoolAddresses()` derives addresses correctly
- [ ] `usePoolAddresses()` returns null for null input

### End-to-End
- [ ] Full deployment flow succeeds on devnet
- [ ] Pool becomes tradeable after Phase 2
- [ ] Database records match on-chain state
- [ ] Error messages are user-friendly
- [ ] Transaction confirmation is reliable

---

## Migration Notes

### Removed Components

**Deleted**:
- `/src/lib/solana/pool-deployment-transaction.ts` (obsolete)
- `/src/lib/solana/create-pool-transaction.ts` (obsolete)
- `/supabase/functions/app-pool-deployment/` (edge function, obsolete)
- `/supabase/functions/app-deploy-market/` (edge function, obsolete)

**Reason**: Consolidated into SDK transaction builders with client-side signing

### Breaking Changes

**Old Flow (Server-Side)**:
```
Client → API Route → Edge Function → Build TX → Return to Client → Sign → Send
```

**New Flow (Client-Side)**:
```
Client → API Route (validation only) → Client derives PDAs → Client builds TX → Sign → Send → Record
```

**Migration Steps for Existing Code**:
1. Replace `buildCreatePoolTransaction()` calls with `useDeployPool()` hook
2. Remove edge function calls (`app-pool-deployment`, `app-deploy-market`)
3. Use `usePoolAddresses()` for PDA derivation instead of API calls
4. Update environment variables (remove edge function configs)

---

## Performance Characteristics

### Latency

| Operation | Time | Bottleneck |
|-----------|------|------------|
| API validation | 100-200ms | Database queries |
| PDA derivation (client) | <10ms | CPU (negligible) |
| Transaction building | 50-100ms | Anchor IDL parsing |
| Wallet signing | 1-5s | User interaction |
| RPC submission | 200-500ms | Network |
| Confirmation (devnet) | 1-2s | Block production |
| DB recording | 100-200ms | Database write |

**Total End-to-End**: ~4-10 seconds for full 2-phase deployment

### Optimization Opportunities

1. **Parallel Phase Recording**: Don't block on DB writes during confirmation
2. **Optimistic UI**: Show "deploying" state immediately
3. **Prefetch Factory**: Cache pool authority to skip RPC call
4. **Batch Confirmations**: Use WebSocket for real-time updates

---

## Security Considerations

1. **Client-Side Signing**: User retains full custody, can't be front-run
2. **API Validation**: Prevents unauthorized deployments
3. **Duplicate Prevention**: 409 status prevents pool address collisions
4. **Post Ownership**: Only post creator can deploy pool
5. **No Server Keys**: No hot wallets or server-side signing
6. **Slippage Protection**: Transactions include min output amounts

---

## Future Enhancements

1. **Batch Deployment**: Deploy multiple pools in one transaction
2. **Pool Upgrades**: Allow parameter adjustments via governance
3. **Gasless Deployment**: Protocol-subsidized deployments
4. **Cross-Chain Pools**: Deploy on multiple Solana clusters
5. **Pool Analytics**: Track deployment success rates and gas costs
6. **Automated Market Making**: Protocol-owned liquidity provisioning

---

## Related Documentation

- [Pool Deployment Flow Spec](../../solana-specs/pool-deployment-flow.md)
- [ICBS Architecture](../../solana-specs/smart-contracts/ICBS-market.md)
- [ContentPool Smart Contract](../../solana-specs/smart-contracts/ContentPool.md)
- [PoolFactory Smart Contract](../../solana-specs/smart-contracts/PoolFactory.md)

---

## Changelog

**October 2025 v2.1**:
- **Combined into single transaction**: create_pool + deploy_market now atomic
- User signs once instead of twice
- Simplified /api/pools/record to handle one-phase recording
- Removed /api/pools/deploy-market validation endpoint (no longer needed)

**October 2025 v2.0**:
- Migrated to client-side transaction building
- Removed edge functions (app-pool-deployment, app-deploy-market)
- Consolidated SDK in transaction-builders.ts
- Created reusable hooks (useDeployPool, usePoolAddresses)
- Simplified API routes to validation-only
- Added /api/pools/record for post-confirmation DB writes
