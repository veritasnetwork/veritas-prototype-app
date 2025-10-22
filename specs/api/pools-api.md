# Pools API

## Overview
Endpoints for deploying ICBS markets, recording deployments, and settling pool epochs.

## Context
- **Layer:** App + Solana
- **Auth:** Mixed (see individual endpoints)
- **Dependencies:** Solana RPC, buildDeployMarketTx, buildSettleEpochTx, Supabase
- **Used By:** useDeployPool hook, settlement service

---

## Endpoints

### POST `/api/pools/deploy-market`

Deploy new ICBS market for a post (current flow).

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  post_id: string,               // UUID
  initial_deposit_usdc: number,  // USDC amount (e.g., 10.0)
  f?: number,                    // Growth exponent (default from factory)
  beta_num?: number,             // Beta numerator (default from factory)
  beta_den?: number              // Beta denominator (default from factory)
}
```

**Response (200):**
```typescript
{
  transaction: string,           // Base64 serialized transaction
  pool_address: string,          // Derived pool PDA
  long_mint: string,             // LONG token mint address
  short_mint: string,            // SHORT token mint address
  metadata: {
    content_id: string,
    deployer: string,
    initial_deposit: number,
    f: number,
    beta_num: number,
    beta_den: number
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid post_id | `{error: "Invalid post ID"}` |
| 400 | Invalid deposit amount | `{error: "Deposit must be >= 1 USDC"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 404 | Post not found | `{error: "Post not found"}` |
| 409 | Pool already exists | `{error: "Pool already deployed for this post"}` |
| 500 | Transaction build failed | `{error: "Failed to build transaction"}` |

**Implementation:** `app/api/pools/deploy-market/route.ts`

**Flow:**
1. Validate auth token → Extract user_id + Solana address
2. Parse request body
3. Validate post_id exists and has no pool yet
4. Validate initial_deposit >= 1 USDC
5. Convert post_id UUID → content_id PublicKey
6. Build deploy_market transaction with buildDeployMarketTx()
7. Sign with protocol authority (for custodian operations)
8. Derive pool PDAs (pool, LONG mint, SHORT mint)
9. Return partially-signed transaction + metadata

**Validation Rules:**
- `post_id`: Must be valid UUID and exist in database
- `initial_deposit_usdc`: >= 1.0, <= 100000.0
- `f`, `beta_num`, `beta_den`: Optional, use factory defaults if omitted

**Edge Cases:**
- Pool already deployed → 409 Conflict
- User doesn't have Solana wallet → 400 Bad Request
- Transaction build fails → 500 with error details

---

### POST `/api/pools/deploy`

Legacy pool deployment endpoint (may be deprecated).

**Auth:** Required (Privy JWT)

**Note:** This endpoint uses the old `buildCreatePoolTx` flow via PoolFactory. The new flow is `/api/pools/deploy-market` which uses `buildDeployMarketTx`.

**Request:**
```typescript
{
  post_id: string,
  f?: number,
  beta_num?: number,
  beta_den?: number
}
```

**Response (200):**
```typescript
{
  transaction: string,
  pool_address: string,
  metadata: object
}
```

**Implementation:** `app/api/pools/deploy/route.ts`

---

### POST `/api/pools/record`

Record successful pool deployment in database.

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  tx_signature: string,
  post_id: string,
  pool_address: string,
  long_mint: string,
  short_mint: string,
  initial_deposit: number,
  f: number,
  beta_num: number,
  beta_den: number
}
```

**Response (200):**
```typescript
{
  pool_deployment: {
    id: string,
    post_id: string,
    belief_id: string,
    pool_address: string,
    long_mint_address: string,
    short_mint_address: string,
    supply_long: number,
    supply_short: number,
    vault_balance: number,
    f: number,
    beta_num: number,
    beta_den: number,
    deployed_at: string
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid signature | `{error: "Invalid transaction signature"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 404 | Post not found | `{error: "Post not found"}` |
| 409 | Duplicate pool | `{error: "Pool already recorded"}` |
| 500 | DB error | `{error: "Failed to record deployment"}` |

**Implementation:** `app/api/pools/record/route.ts`

**Flow:**
1. Validate auth token
2. Parse request body
3. Validate tx_signature format (base58)
4. Check post exists
5. Check pool not already recorded (unique pool_address)
6. INSERT into `pool_deployments` table
7. Link to post via post_id and belief_id
8. Return created record

**Validation Rules:**
- `tx_signature`: Valid base58, 88 chars
- `pool_address`: Valid Solana address
- `long_mint`, `short_mint`: Valid Solana addresses
- `initial_deposit`: > 0

**Edge Cases:**
- Duplicate tx_signature → 409 Conflict
- Transaction not confirmed on-chain → Accept (will be confirmed by indexer)
- Post already has pool → 409 Conflict

---

### POST `/api/pools/settle`

Settle pool epoch with BD score (admin only).

**Auth:** Admin (protocol authority)

**Request:**
```typescript
{
  pool_address: string,
  bd_score: number,              // 0-1 range (e.g., 0.65 = 65% relevance)
  epoch: number
}
```

**Response (200):**
```typescript
{
  transaction: string,           // Base64 serialized settlement tx
  settlement: {
    pool_address: string,
    epoch: number,
    bd_score: number,
    f_long: number,              // Scaling factor for LONG reserves
    f_short: number,             // Scaling factor for SHORT reserves
    reserves_long_before: number,
    reserves_long_after: number,
    reserves_short_before: number,
    reserves_short_after: number
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid bd_score | `{error: "BD score must be 0-1"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 403 | Not admin | `{error: "Admin access required"}` |
| 404 | Pool not found | `{error: "Pool not found"}` |
| 409 | Already settled | `{error: "Epoch already settled"}` |
| 500 | Transaction build failed | `{error: "Failed to build settlement"}` |

**Implementation:** `app/api/pools/settle/route.ts`

**Flow:**
1. Validate admin auth
2. Parse request body
3. Validate bd_score in [0, 1]
4. Fetch pool state from chain
5. Check epoch not already settled
6. Build settle_epoch transaction
7. Sign with protocol authority
8. Calculate expected reserve changes
9. Return signed transaction + settlement metadata

**Validation Rules:**
- `bd_score`: Float in [0.0, 1.0]
- `epoch`: Integer >= 0
- `pool_address`: Valid Solana address, must exist on-chain

**Edge Cases:**
- Pool not deployed yet → 404
- Epoch already settled → 409 Conflict
- BD score = 0.5 → No reserve change (neutral)
- BD score = 0 → SHORT reserves increase, LONG decrease
- BD score = 1 → LONG reserves increase, SHORT decrease

---

### GET `/api/config/pool`

Get default pool configuration parameters.

**Auth:** Public

**Parameters:** None

**Response (200):**
```typescript
{
  defaults: {
    f: number,                   // Growth exponent (e.g., 3)
    beta_num: number,            // Beta numerator (e.g., 1)
    beta_den: number,            // Beta denominator (e.g., 2)
    min_initial_deposit: number, // Minimum USDC deposit
    min_settle_interval: number  // Minimum seconds between settlements
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 500 | Failed to fetch config | `{error: "Failed to get pool config"}` |

**Implementation:** `app/api/config/pool/route.ts`

**Flow:**
1. Fetch PoolFactory state from Solana
2. Extract default parameters
3. Return config object

---

## Data Structures

### Pool Deployment Schema (Database)
```sql
CREATE TABLE pool_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id),
  belief_id UUID REFERENCES beliefs(id),
  pool_address TEXT UNIQUE NOT NULL,
  long_mint_address TEXT NOT NULL,
  short_mint_address TEXT NOT NULL,
  supply_long NUMERIC DEFAULT 0,
  supply_short NUMERIC DEFAULT 0,
  sqrt_price_long_x96 TEXT,
  sqrt_price_short_x96 TEXT,
  vault_balance NUMERIC DEFAULT 0,
  f INTEGER DEFAULT 3,
  beta_num INTEGER DEFAULT 1,
  beta_den INTEGER DEFAULT 2,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'settled', 'closed'))
);
```

### Settlement Schema (Database)
```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT REFERENCES pool_deployments(pool_address),
  epoch INTEGER NOT NULL,
  bd_score NUMERIC NOT NULL,
  f_long NUMERIC NOT NULL,
  f_short NUMERIC NOT NULL,
  reserves_long_before NUMERIC,
  reserves_long_after NUMERIC,
  reserves_short_before NUMERIC,
  reserves_short_after NUMERIC,
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  tx_signature TEXT UNIQUE,
  event_signature TEXT UNIQUE,
  UNIQUE(pool_address, epoch)
);
```

---

## Testing

### Critical Paths
1. POST deploy-market valid → returns transaction
2. POST deploy-market duplicate → 409
3. POST record valid → creates deployment record
4. POST record duplicate → 409
5. POST settle valid → builds settlement tx
6. POST settle invalid BD score → 400
7. GET config → returns defaults

### Test Implementation
- **Test Spec:** `specs/test-specs/api/pools-api.test.md`
- **Test Code:** `tests/api/pools.test.ts`

### Validation
- Pool deployment creates all necessary PDAs
- Settlement calculations match on-chain logic
- Duplicate prevention works correctly
- Admin auth enforced for settlement

---

## References
- Code: `app/api/pools/deploy-market/route.ts`, `app/api/pools/settle/route.ts`
- Transactions: `src/lib/solana/sdk/transaction-builders.ts`
- Database: `specs/data-structures/01-protocol-tables.md`
- Related: `specs/architecture/trading-flow.md`, `specs/solana-specs/smart-contracts/ContentPool.md`
