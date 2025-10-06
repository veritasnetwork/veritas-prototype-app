# Pool Deployment Flow Specification

## Overview

This document specifies the complete end-to-end flow for deploying a ContentPool on Solana when a user creates a post. The flow is split between backend (edge functions) and frontend (Next.js + Privy), with transaction signing happening client-side.

## Architecture

```
User creates post → Edge function (app-post-creation)
                  → Derives pool PDAs
                  → Records deployment in DB (tx_signature: null)
                  → Returns pool addresses to client

Client receives pool addresses → Builds pool creation transaction
                               → Prompts user to sign (Privy)
                               → Submits transaction to Solana
                               → Calls update-pool-deployment

Edge function (update-pool-deployment) → Updates DB record with tx_signature
                                      → Marks deployment as confirmed
```

## Components

### 1. `app-post-creation` (Existing, Extended)

**Purpose**: Create post, belief, and prepare Solana pool deployment

**Inputs**:
```typescript
{
  user_id: string
  title: string
  content: string
  initial_belief: number  // 0-1
  meta_prediction?: number  // 0-1
  duration_epochs?: number  // default 10
}
```

**Process**:
1. Create belief (via `protocol-belief-creation`)
2. Create post record
3. **If `SOLANA_PROGRAM_ID` configured**:
   - Derive pool PDAs:
     - Pool address: `["pool", post_id_bytes]`
     - Token mint: `["mint", post_id_bytes]`
     - USDC vault: `["vault", post_id_bytes]`
   - Call `record_pool_deployment()` database function:
     - Stores pool addresses
     - Stores curve parameters (k_quadratic, reserve_cap, etc.)
     - Sets `deployment_tx_signature: null`
     - Sets `deployed_at: NOW()`

**Output**:
```typescript
{
  post_id: string
  belief_id: string
  post: { ... }
  belief: { ... }
  pool?: {
    pool_address: string           // Base58 Solana address
    token_mint_address: string     // Base58 Solana address
    usdc_vault_address: string     // Base58 Solana address
    deployment_recorded: boolean   // true
  }
}
```

**Key Point**: Edge function does NOT submit on-chain transaction. It only prepares database records and returns addresses.

---

### 2. Client-Side Transaction Flow (Next.js + Privy)

**Location**: `app/components/CreatePostForm.tsx` (or similar)

**Dependencies**:
- `@privy-io/react-auth` - Wallet connection
- `@solana/web3.js` - Transaction building
- `app/lib/solana/transaction-builders.ts` - Transaction helpers

**Flow**:

```typescript
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth'
import { Connection, Transaction } from '@solana/web3.js'
import { buildCreatePoolTx } from '@/lib/solana/transaction-builders'

async function handleCreatePost(formData) {
  // 1. Call edge function to create post + prepare pool
  const response = await fetch('/functions/v1/app-post-creation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: user.id,
      title: formData.title,
      content: formData.content,
      initial_belief: formData.initial_belief,
      meta_prediction: formData.meta_prediction
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error)
  }

  // 2. If pool deployment was recorded, prompt user to sign transaction
  if (data.pool) {
    const { solanaWallets } = useSolanaWallets()
    const wallet = solanaWallets[0]

    if (!wallet) {
      // Show error: "Solana wallet not connected"
      return
    }

    try {
      // 3. Build the pool creation transaction
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT!,
        'confirmed'
      )

      const tx = await buildCreatePoolTx({
        connection,
        creator: wallet.address,
        postId: data.post_id,
        kQuadratic: 1_000_000,      // Default from config
        reserveCap: 5_000_000_000,  // Default from config
        linearSlope: 1_000_000_000, // Default from config
        virtualLiquidity: 1_000_000_000, // Default from config
        programId: process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID!
      })

      // 4. Request signature from user via Privy
      const signature = await wallet.signAndSendTransaction(tx)

      console.log('Pool created on-chain:', signature)

      // 5. Update database with transaction signature
      await fetch('/functions/v1/update-pool-deployment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pool_address: data.pool.pool_address,
          tx_signature: signature
        })
      })

      // 6. Show success message
      toast.success('Post and pool created successfully!')
      router.push(`/posts/${data.post_id}`)

    } catch (error) {
      console.error('Pool deployment failed:', error)

      // Pool deployment failed, but post was still created
      // Show partial success message
      toast.warning('Post created, but pool deployment failed. You can retry later.')
      router.push(`/posts/${data.post_id}`)
    }
  } else {
    // No Solana integration configured, just show post created
    toast.success('Post created!')
    router.push(`/posts/${data.post_id}`)
  }
}
```

**Key Points**:
- User MUST sign transaction (their wallet is the pool creator)
- Transaction is built client-side using pool addresses from edge function
- Failure to deploy pool doesn't prevent post creation (graceful degradation)
- Post exists in database even if on-chain deployment fails

---

### 3. `update-pool-deployment` (New Edge Function)

**Purpose**: Record successful on-chain pool deployment

**Endpoint**: `POST /functions/v1/update-pool-deployment`

**Inputs**:
```typescript
{
  pool_address: string      // Base58 Solana address
  tx_signature: string      // Base58 transaction signature
}
```

**Process**:
1. Validate `pool_address` exists in `pool_deployments` table
2. Verify `tx_signature` is valid (optional: check on-chain confirmation)
3. Update record:
   ```sql
   UPDATE pool_deployments
   SET
     deployment_tx_signature = $tx_signature,
     last_synced_at = NOW()
   WHERE pool_address = $pool_address
   ```

**Output**:
```typescript
{
  success: true
  pool_address: string
  tx_signature: string
  confirmed_at: string
}
```

**Error Cases**:
- `404`: Pool address not found
- `409`: Deployment already confirmed (tx_signature already set)
- `422`: Invalid transaction signature format
- `500`: Database error

**Implementation**: See edge function below

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
    usdc_vault_address TEXT NOT NULL,
    token_mint_address TEXT NOT NULL,

    -- Deployment info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by_agent_id UUID REFERENCES agents(id),
    deployment_tx_signature TEXT UNIQUE,  -- NULL until client confirms

    -- Curve parameters (cached from chain)
    k_quadratic NUMERIC NOT NULL,
    reserve_cap NUMERIC NOT NULL,
    linear_slope NUMERIC NOT NULL,
    virtual_liquidity NUMERIC NOT NULL,

    -- Current state (synced from chain)
    token_supply NUMERIC DEFAULT 0,
    reserve NUMERIC DEFAULT 0,
    last_synced_at TIMESTAMPTZ
);
```

**Key Field**: `deployment_tx_signature`
- **NULL**: Pool addresses derived, but on-chain transaction not yet submitted
- **String**: On-chain transaction confirmed, pool exists on Solana

---

## Privy Configuration

### Enable Solana Wallet Support

**In Privy Dashboard**:
1. Go to app settings
2. Enable "Solana" under wallet providers
3. Configure network:
   - Development: Solana Devnet
   - Production: Solana Mainnet

**In Next.js** (`app/layout.tsx`):
```typescript
import { PrivyProvider } from '@privy-io/react-auth'
import { solanaDevnet } from '@privy-io/react-auth/solana'

<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
    loginMethods: ['email', 'wallet', 'apple'],
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      requireUserPasswordOnCreate: false,
    },
    supportedChains: [solanaDevnet], // Enable Solana
  }}
>
  {children}
</PrivyProvider>
```

---

## Environment Variables

### Backend (Supabase Edge Functions)

```bash
SOLANA_PROGRAM_ID=<your_program_id>
SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899  # localnet
# SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com  # devnet
```

### Frontend (Next.js)

```bash
NEXT_PUBLIC_SOLANA_PROGRAM_ID=<your_program_id>
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_PRIVY_APP_ID=<your_privy_app_id>
```

---

## Security Considerations

### 1. Transaction Validation
- **Client-side**: User must explicitly approve transaction via Privy
- **Backend**: Edge function trusts client-provided signature (low risk since pool creation is permissionless)
- **Future improvement**: Verify transaction signature on-chain before updating DB

### 2. Rate Limiting
- Implement rate limiting on `update-pool-deployment` endpoint
- Prevent spam updates with invalid signatures

### 3. Error Handling
- Post creation succeeds even if pool deployment fails
- User can retry pool deployment later (future feature)
- Database maintains referential integrity (posts → beliefs → pools)

---

## Future Enhancements

### 1. Transaction Confirmation Verification
Currently, `update-pool-deployment` trusts client-provided signature. Could add:
```typescript
// Verify transaction on-chain
const connection = new Connection(SOLANA_RPC_ENDPOINT)
const txInfo = await connection.getTransaction(tx_signature, {
  commitment: 'confirmed'
})

if (!txInfo || txInfo.meta?.err) {
  throw new Error('Transaction not found or failed')
}
```

### 2. Pool State Syncing
Add edge function to periodically sync pool state from chain:
```typescript
// supabase/functions/sync-pool-state/index.ts
async function syncPoolState(pool_address: string) {
  const poolAccount = await program.account.contentPool.fetch(pool_address)

  await db.pool_deployments
    .update({
      token_supply: poolAccount.tokenSupply,
      reserve: poolAccount.reserve,
      last_synced_at: new Date()
    })
    .eq('pool_address', pool_address)
}
```

### 3. Retry Pool Deployment
Allow users to retry pool deployment if initial attempt failed:
- Add "Deploy Pool" button on posts without confirmed pools
- Reuse existing pool addresses from `pool_deployments` table
- Don't create duplicate pool records

---

## Testing Checklist

- [ ] User creates post with Solana disabled → success (no pool)
- [ ] User creates post with Solana enabled → pool addresses returned
- [ ] User signs pool creation transaction → tx submitted on-chain
- [ ] `update-pool-deployment` called with valid signature → DB updated
- [ ] User rejects signature → post still exists, pool unconfirmed
- [ ] Network error during transaction → graceful error handling
- [ ] Duplicate `update-pool-deployment` call → idempotent or 409 error
- [ ] Invalid pool address → 404 error
- [ ] Invalid tx signature format → 422 error

---

## Implementation Order

1. ✅ Extend `app-post-creation` to derive pool PDAs and record deployment
2. **Next**: Create `update-pool-deployment` edge function
3. Copy `transaction-builders.ts` to Next.js `app/lib/solana/`
4. Update Privy configuration to enable Solana
5. Update post creation UI to handle transaction signing
6. Add environment variables to both backend and frontend
7. Test end-to-end flow on localnet
8. Deploy to devnet for pre-production testing
