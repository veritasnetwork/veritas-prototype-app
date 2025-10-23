# Pool Deployment Flow Specification (ICBS Architecture)

## Overview

This document specifies the complete end-to-end flow for deploying an ICBS ContentPool on Solana when a user creates a post. The deployment happens in **two phases**:

1. **Pool Creation** - Creates the pool account and registry
2. **Market Deployment** - Creates LONG/SHORT token mints, vault, and adds initial liquidity

All transaction signing happens client-side via Privy.

## Architecture

```
User creates post → Edge function (app-post-creation)
                  → Creates belief in protocol layer
                  → Creates post record
                  → Returns post_id to client

Client receives post_id → Calls app-pool-deployment edge function
                        → Receives pool PDA addresses
                        → Builds create_pool transaction
                        → User signs via Privy
                        → Submits to Solana
                        → Polls for confirmation
                        → Calls app-deploy-market edge function
                        → Receives market PDA addresses
                        → Builds deploy_market transaction
                        → User signs via Privy
                        → Submits to Solana
                        → Pool is now fully deployed and tradeable
```

## ICBS Two-Sided Market

Unlike traditional bonding curves, ICBS uses:
- **Two separate tokens**: LONG (bullish) and SHORT (bearish)
- **Inversely coupled pricing**: As one side increases, the other decreases
- **Cost function**: C(s_L, s_S) = λ × (s_L^(F/β) + s_S^(F/β))^β
- **Settlement mechanism**: Reserves scale based on BD relevance score vs market prediction

### Key Parameters

- **F** (growth exponent): Controls price sensitivity to supply changes (typically 2)
- **β** (coupling coefficient): Controls coupling between LONG/SHORT (typically 0.5)
- **λ** (lambda): Price scaling factor, set at deployment for initial p=1

## Components

### 1. `app-post-creation` (Existing)

**Purpose**: Create post and belief in app/protocol layers

**Inputs**:
```typescript
{
  user_id: string
  title: string
  content: string
  initial_belief: number  // 0-1
  meta_prediction?: number  // 0-1
  duration_epochs?: number
}
```

**Process**:
1. Create belief via `protocol-belief-creation`
2. Create post record with `belief_id`
3. Return post data to client

**Output**:
```typescript
{
  post_id: string
  belief_id: string
  post: { ... }
  belief: { ... }
}
```

**Note**: This edge function does NOT create pool records or derive Solana addresses. Pool deployment is a separate client-side flow.

---

### 2. `app-pool-deployment` (Edge Function)

**Purpose**: Return pool PDA addresses for client-side transaction building

**Endpoint**: `POST /functions/v1/app-pool-deployment`

**Inputs**:
```typescript
{
  post_id: string  // UUID
}
```

**Process**:
1. Validate post exists and user has permission
2. Check if pool already deployed (avoid duplicates)
3. Derive content ID pubkey from `post_id`
4. Derive all pool PDAs using PoolFactory seeds:
   - Pool: `["content_pool", content_id_pubkey]`
   - Registry: `["pool_registry", content_id_pubkey]`
5. Return addresses (mints/vault will be created in phase 2)

**Output**:
```typescript
{
  pool_address: string           // Base58
  registry_address: string       // Base58
  content_id_pubkey: string      // Base58 (derived from post_id)
  factory_address: string        // Base58
  custodian_address: string      // Base58
}
```

**Key Point**: This edge function does NOT build transactions. It only returns addresses needed by the client.

---

### 3. Client-Side Pool Creation (Phase 1)

**Location**: `src/lib/solana/create-pool-transaction.ts`

**Flow**:
```typescript
import { buildCreatePoolTransaction } from '@/lib/solana/create-pool-transaction'
import { useSolanaWallet } from '@/hooks/useSolanaWallet'

async function deployPool(postId: string) {
  // 1. Get pool addresses from edge function
  const response = await fetch('/api/pools/prepare', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId })
  })
  const addresses = await response.json()

  // 2. Build create_pool transaction
  const { wallet } = useSolanaWallet()
  const tx = await buildCreatePoolTransaction({
    contentIdPubkey: new PublicKey(addresses.content_id_pubkey),
    walletPubkey: wallet.publicKey
  })

  // 3. User signs and sends
  const signedTx = await wallet.signTransaction(tx)
  const signature = await connection.sendRawTransaction(signedTx.serialize())
  await connection.confirmTransaction(signature, 'confirmed')

  // 4. Pool created! Now proceed to phase 2 (deploy market)
  return { signature, addresses }
}
```

**What happens on-chain**:
- `PoolFactory::create_pool` instruction executed
- Creates `ContentPool` account
- Creates `PoolRegistry` account
- Sets initial parameters (F, β, creator)
- Does NOT create mints or vault yet

---

### 4. `app-deploy-market` (Edge Function)

**Purpose**: Return market PDA addresses for deploying LONG/SHORT tokens

**Endpoint**: `POST /functions/v1/app-deploy-market`

**Inputs**:
```typescript
{
  pool_address: string        // From phase 1
  initial_usdc_amount: number // USDC to deposit (in lamports)
  long_ratio: number          // 0-1, fraction for LONG side
}
```

**Process**:
1. Validate pool exists on-chain (fetch pool account)
2. Validate pool not already deployed (check `deployed` flag)
3. Derive market PDAs:
   - Long mint: `["long_mint", content_id_pubkey]`
   - Short mint: `["short_mint", content_id_pubkey]`
   - Vault: `["vault", content_id_pubkey]`
   - Creator long ATA
   - Creator short ATA
4. Return addresses for transaction building

**Output**:
```typescript
{
  long_mint: string           // Base58
  short_mint: string          // Base58
  vault_address: string       // Base58
  creator_long_ata: string    // Base58
  creator_short_ata: string   // Base58
}
```

---

### 5. Client-Side Market Deployment (Phase 2)

**Location**: `src/lib/solana/pool-deployment-transaction.ts`

**Flow**:
```typescript
import { buildDeployMarketTransaction } from '@/lib/solana/pool-deployment-transaction'

async function deployMarket(poolAddress: string, usdcAmount: number, longRatio: number) {
  // 1. Get market addresses
  const response = await fetch('/api/pools/deploy-market', {
    method: 'POST',
    body: JSON.stringify({
      pool_address: poolAddress,
      initial_usdc_amount: usdcAmount,
      long_ratio: longRatio
    })
  })
  const addresses = await response.json()

  // 2. Build deploy_market transaction
  const tx = await buildDeployMarketTransaction({
    poolPubkey: new PublicKey(poolAddress),
    creatorPubkey: wallet.publicKey,
    usdcAmount,
    longRatio,
    ...addresses
  })

  // 3. User signs and sends
  const signedTx = await wallet.signTransaction(tx)
  const signature = await connection.sendRawTransaction(signedTx.serialize())
  await connection.confirmTransaction(signature, 'confirmed')

  // 4. Market deployed! Pool is now tradeable
  return signature
}
```

**What happens on-chain**:
- `ContentPool::deploy_market` instruction executed
- Creates LONG and SHORT token mints
- Creates USDC vault
- Calculates lambda for initial price p=1
- Adds initial liquidity according to `long_ratio`
- Mints initial LONG and SHORT tokens to creator
- Sets pool `deployed = true`

---

### 6. Recording Deployment in Database

After successful on-chain deployment, record in `pool_deployments` table:

```typescript
// After both transactions confirm
await fetch('/api/pools/record-deployment', {
  method: 'POST',
  body: JSON.stringify({
    post_id: postId,
    pool_address: poolAddress,
    long_mint: addresses.long_mint,
    short_mint: addresses.short_mint,
    vault_address: addresses.vault_address,
    create_tx_signature: createSignature,
    deploy_tx_signature: deploySignature,
    initial_usdc: usdcAmount,
    long_ratio: longRatio
  })
})
```

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
    long_mint TEXT NOT NULL,
    short_mint TEXT NOT NULL,
    usdc_vault_address TEXT NOT NULL,

    -- Deployment info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by_agent_id UUID REFERENCES agents(id),
    create_tx_signature TEXT,   -- Phase 1 transaction
    deploy_tx_signature TEXT,   -- Phase 2 transaction

    -- ICBS parameters (cached from chain)
    f SMALLINT NOT NULL,              -- Growth exponent
    beta_num SMALLINT NOT NULL,       -- Coupling coefficient numerator
    beta_den SMALLINT NOT NULL,       -- Coupling coefficient denominator
    sqrt_lambda_x96 NUMERIC NOT NULL, -- Price scaling factor (X96 format)

    -- Initial deployment state
    initial_s_long NUMERIC NOT NULL,  -- Initial LONG supply
    initial_s_short NUMERIC NOT NULL, -- Initial SHORT supply
    initial_usdc NUMERIC NOT NULL,    -- Initial USDC deposited

    -- Current state (synced from chain)
    s_long NUMERIC,                   -- Current LONG supply
    s_short NUMERIC,                  -- Current SHORT supply
    sqrt_price_long_x96 NUMERIC,      -- Current LONG sqrt price
    sqrt_price_short_x96 NUMERIC,     -- Current SHORT sqrt price
    last_synced_at TIMESTAMPTZ,

    -- Settlement tracking
    last_settlement_epoch INTEGER,
    last_settlement_tx TEXT,

    CONSTRAINT valid_beta CHECK (beta_den > 0),
    CONSTRAINT valid_f CHECK (f > 0)
);
```

**Key Differences from Old Schema**:
- ✅ Added `long_mint` and `short_mint` (two-sided market)
- ✅ Removed `token_mint_address` (single-sided, deprecated)
- ✅ Added ICBS parameters: `f`, `beta_num`, `beta_den`, `sqrt_lambda_x96`
- ✅ Removed quadratic curve parameters: `k_quadratic`, `reserve_cap`, `linear_slope`, `virtual_liquidity`
- ✅ Added `s_long`, `s_short`, `sqrt_price_long_x96`, `sqrt_price_short_x96`
- ✅ Removed `token_supply` and `reserve` (replaced by ICBS state)

---

## ICBS Pricing and Settlement

### Initial Deployment Pricing

When deploying a market with `initial_usdc` and `long_ratio`:

1. Calculate initial supplies:
   ```
   s_long = initial_usdc * long_ratio
   s_short = initial_usdc * (1 - long_ratio)
   ```

2. Calculate lambda for p=1:
   ```
   λ = 1 / (F × s^(F/β - 1) × sum^(β-1))
   ```
   This ensures marginal price = 1.0 for both tokens at deployment.

3. Store `sqrt_lambda_x96 = sqrt(λ) × 2^96` in pool account

### Settlement Mechanism

Every epoch, pools settle based on BD relevance score:

1. Calculate market prediction: `q = s_long / (s_long + s_short)`
2. Get BD relevance score: `x` from protocol layer
3. Scale reserves:
   ```
   s_long_new = s_long × (x / q)
   s_short_new = s_short × ((1-x) / (1-q))
   ```
4. Prices adjust automatically (homogeneity property)
5. No USDC balance changes (pure virtual reserve scaling)

**Key insight**: Settlement rewards/punishes traders by changing token backing, not by transferring USDC.

---

## Environment Variables

### Backend (Supabase Edge Functions)

```bash
SOLANA_PROGRAM_ID=<veritas_curation_program_id>
SOLANA_POOL_FACTORY_ADDRESS=<factory_pda>
SOLANA_CUSTODIAN_ADDRESS=<custodian_pda>
USDC_MINT_ADDRESS=<usdc_mint>
SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899  # or devnet/mainnet
```

### Frontend (Next.js)

```bash
NEXT_PUBLIC_SOLANA_PROGRAM_ID=<veritas_curation_program_id>
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_PRIVY_APP_ID=<privy_app_id>
NEXT_PUBLIC_USDC_MINT=<usdc_mint>
```

---

## Testing Checklist

### Phase 1 - Pool Creation
- [ ] User creates pool → `create_pool` transaction succeeds
- [ ] Pool account created with correct F, β parameters
- [ ] Registry account created and linked to pool
- [ ] Cannot create duplicate pool for same content_id

### Phase 2 - Market Deployment
- [ ] User deploys market with 50/50 ratio → equal LONG/SHORT supplies
- [ ] User deploys market with 70/30 ratio → correct supply distribution
- [ ] LONG and SHORT mints created with correct metadata
- [ ] Vault created and owns USDC
- [ ] Initial prices calculated correctly (p ≈ 1.0)
- [ ] Cannot deploy market twice on same pool

### Trading
- [ ] Buy LONG tokens → price increases, receive correct amount
- [ ] Sell LONG tokens → price decreases, receive correct USDC
- [ ] Buy SHORT tokens → independent from LONG side
- [ ] Sell SHORT tokens → correct USDC payout

### Settlement
- [ ] Settle with x > q → LONG holders gain, SHORT holders lose
- [ ] Settle with x < q → SHORT holders gain, LONG holders lose
- [ ] Settle with x = q → no change (neutral)
- [ ] Virtual reserves scale correctly
- [ ] Prices adjust post-settlement

---

## Implementation Status

- ✅ Smart contracts deployed (ContentPool, PoolFactory, VeritasCustodian)
- ✅ Client-side transaction builders implemented
- ✅ ICBS math implemented with fractional power support
- ✅ Settlement logic implemented
- ⚠️ Edge functions need update for ICBS parameters
- ⚠️ Database schema needs migration for ICBS fields
- ⚠️ Frontend UI needs two-phase deployment flow
- ⚠️ Event indexer for real-time pool state sync (in progress)

---

## Migration from Quadratic Curve

If migrating from old quadratic curve system:

1. Add new columns to `pool_deployments` table
2. Mark old pools as `deprecated = true`
3. New posts use ICBS architecture
4. Old pools continue to function (no breaking changes)
5. Gradual migration: allow users to upgrade pools to ICBS

---

## Future Enhancements

1. **Automated Market Making**: Protocol-owned liquidity provision
2. **Pool Analytics**: Track volume, price history, settlement impact
3. **Batch Deployment**: Deploy multiple pools in one transaction
4. **Pool Upgrades**: Allow parameter adjustments (with governance)
5. **Cross-pool Arbitrage**: Detect and alert on arbitrage opportunities
