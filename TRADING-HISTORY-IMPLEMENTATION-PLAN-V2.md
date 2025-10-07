# Trading History Implementation Plan v2
## Simplified 3-Table Architecture

**Status:** Ready to implement
**Architecture:** Elite data engineering pattern (fact table + time-series + materialized aggregate)

---

## Architecture Overview

### Core Principle
**Single source of truth** → **Derived views** → **Fast queries**

```
trades (fact table)
  ↓ derive
pool_price_snapshots (VIEW)
  ↓ query
Charts & Analytics

trades (fact table)
  ↓ trigger
user_pool_balances (aggregate)
  ↓ query
User Portfolio
```

---

## Schema (3 Tables + 1 View)

### 1. `trades` - Immutable Fact Table (Source of Truth)
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address),
  post_id UUID NOT NULL REFERENCES posts(id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Trade details
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  token_amount NUMERIC NOT NULL CHECK (token_amount > 0),
  usdc_amount NUMERIC NOT NULL CHECK (usdc_amount > 0),

  -- Pool state AFTER trade (for price calculation)
  token_supply_after NUMERIC NOT NULL CHECK (token_supply_after >= 0),
  reserve_after NUMERIC NOT NULL CHECK (reserve_after >= 0),
  k_quadratic NUMERIC NOT NULL, -- Denormalized for price calc

  -- Blockchain proof
  tx_signature TEXT NOT NULL UNIQUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for access patterns
CREATE INDEX idx_trades_user_time ON trades(user_id, recorded_at DESC);
CREATE INDEX idx_trades_pool_time ON trades(pool_address, recorded_at DESC);
CREATE INDEX idx_trades_post_time ON trades(post_id, recorded_at DESC);
CREATE INDEX idx_trades_time ON trades(recorded_at DESC);
CREATE INDEX idx_trades_tx ON trades(tx_signature);
```

**Key decisions:**
- ✅ Stores pool state AFTER trade (not before/after)
- ✅ Denormalizes `k_quadratic` to avoid JOINs for price calculation
- ✅ `recorded_at` = transaction timestamp for charts
- ❌ NO `price_per_token` column (derivable: `usdc_amount / token_amount`)

---

### 2. `belief_relevance_history` - Time-Series Table
```sql
CREATE TABLE belief_relevance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Belief metrics (cannot be reconstructed)
  epoch INTEGER NOT NULL,
  aggregate NUMERIC NOT NULL CHECK (aggregate >= 0 AND aggregate <= 1),
  delta_relevance NUMERIC NOT NULL CHECK (delta_relevance >= -1 AND delta_relevance <= 1),
  certainty NUMERIC NOT NULL CHECK (certainty >= 0 AND certainty <= 1),
  disagreement_entropy NUMERIC,

  -- Timestamp for charts
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(belief_id, epoch)
);

-- Indexes
CREATE INDEX idx_belief_history_belief_epoch ON belief_relevance_history(belief_id, epoch DESC);
CREATE INDEX idx_belief_history_post_epoch ON belief_relevance_history(post_id, epoch DESC);
CREATE INDEX idx_belief_history_epoch ON belief_relevance_history(epoch, recorded_at);
```

**Key decisions:**
- ✅ Essential - cannot derive from other tables
- ✅ One row per belief per epoch (unique constraint)
- ✅ `recorded_at` = when epoch processing completed

---

### 3. `user_pool_balances` - Aggregated Current State
```sql
CREATE TABLE user_pool_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Current holdings
  token_balance NUMERIC NOT NULL DEFAULT 0 CHECK (token_balance >= 0),

  -- Lifetime cumulative stats
  total_bought NUMERIC NOT NULL DEFAULT 0,
  total_sold NUMERIC NOT NULL DEFAULT 0,
  total_usdc_spent NUMERIC NOT NULL DEFAULT 0,
  total_usdc_received NUMERIC NOT NULL DEFAULT 0,

  -- Timestamps
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, pool_address)
);

-- Indexes for fast lookups
CREATE INDEX idx_balances_user ON user_pool_balances(user_id);
CREATE INDEX idx_balances_pool_balance ON user_pool_balances(pool_address, token_balance DESC);
CREATE INDEX idx_balances_user_pool ON user_pool_balances(user_id, pool_address);
```

**Key decisions:**
- ✅ ONE row per user-pool pair (current state, NOT history)
- ✅ Auto-updated by trigger when trades inserted
- ✅ Calculated fields (avg_buy_price, PnL) computed in queries or trigger
- ✅ Renamed from `user_pool_positions` for clarity

---

### 4. `pool_price_snapshots` - Derived VIEW (Not a Table!)
```sql
CREATE VIEW pool_price_snapshots AS
SELECT
  pool_address,
  post_id,
  -- Calculate price from bonding curve: P = R / (k * S²)
  reserve_after / NULLIF(k_quadratic * POWER(token_supply_after, 2), 0) as price,
  token_supply_after as token_supply,
  reserve_after as reserve,
  recorded_at,
  trade_type as triggered_by,
  tx_signature
FROM trades
ORDER BY pool_address, recorded_at;
```

**Key decisions:**
- ✅ NOT a table - derived from `trades` on-read
- ✅ No duplicate data storage
- ✅ Always accurate (calculated from source of truth)
- ✅ Can upgrade to MATERIALIZED VIEW if slow

**If performance requires materialization:**
```sql
CREATE MATERIALIZED VIEW pool_price_snapshots_mv AS
SELECT ... -- same query

CREATE INDEX idx_price_mv_pool_time ON pool_price_snapshots_mv(pool_address, recorded_at DESC);

-- Refresh trigger (optional)
CREATE TRIGGER refresh_price_snapshots
AFTER INSERT ON trades
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_price_mv();
```

---

## Trigger: Auto-Update Balances After Trade

```sql
CREATE OR REPLACE FUNCTION update_user_balance_after_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert user balance
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = user_pool_balances.token_balance +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance_after_trade
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_trade();
```

---

## Implementation Timeline

### **Phase 1: Database Foundation** (Day 1-2)

#### Step 1.1: Create Migration
**File:** `supabase/migrations/20250212_create_trading_tables_v2.sql`

```bash
# Include:
- trades table
- belief_relevance_history table
- user_pool_balances table
- pool_price_snapshots VIEW
- Trigger for auto-updating balances
```

#### Step 1.2: Apply Migration
```bash
cd /Users/josh/veritas/veritas-prototype-app
supabase db reset  # Apply all migrations including new one

# Verify tables exist
supabase db status
```

#### Step 1.3: Test Schema
```sql
-- Test trigger works
INSERT INTO trades (...) VALUES (...);
SELECT * FROM user_pool_balances; -- Should auto-update

-- Test VIEW works
SELECT * FROM pool_price_snapshots WHERE pool_address = 'xxx';
```

---

### **Phase 2: Edge Function - Record Trade** (Day 3)

#### Step 2.1: Create Edge Function
**File:** `supabase/functions/solana-record-trade/index.ts`

**Purpose:** Insert trade record after successful on-chain transaction

**Request:**
```typescript
{
  user_id: string;
  pool_address: string;
  post_id: string;
  wallet_address: string;
  trade_type: 'buy' | 'sell';
  token_amount: string;
  usdc_amount: string;
  token_supply_after: string;
  reserve_after: string;
  k_quadratic: string;
  tx_signature: string;
}
```

**Process:**
1. Validate JWT token (user authenticated)
2. Validate inputs (amounts > 0, valid addresses)
3. Insert into `trades` table
4. Trigger auto-updates `user_pool_balances`
5. Return success

**Implementation:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Verify token (Privy JWT)
    // TODO: Add Privy JWT verification

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      user_id,
      pool_address,
      post_id,
      wallet_address,
      trade_type,
      token_amount,
      usdc_amount,
      token_supply_after,
      reserve_after,
      k_quadratic,
      tx_signature
    } = await req.json();

    // Validate inputs
    if (!user_id || !pool_address || !tx_signature) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Insert trade (trigger will update user_pool_balances automatically)
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id,
        pool_address,
        post_id,
        wallet_address,
        trade_type,
        token_amount,
        usdc_amount,
        token_supply_after,
        reserve_after,
        k_quadratic,
        tx_signature,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert trade:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        trade_id: trade.id
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Record trade error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

#### Step 2.2: Deploy Edge Function
```bash
supabase functions deploy solana-record-trade
```

#### Step 2.3: Test Edge Function
```bash
curl -X POST https://your-project.supabase.co/functions/v1/solana-record-trade \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid",
    "pool_address": "...",
    "trade_type": "buy",
    "token_amount": "100",
    "usdc_amount": "1000000",
    "token_supply_after": "1100",
    "reserve_after": "11000000",
    "k_quadratic": "1",
    "tx_signature": "..."
  }'
```

---

### **Phase 3: Sell Functionality** (Day 4-5)

#### Step 3.1: Create Sell Transaction Builder
**File:** `src/lib/solana/sell-transaction.ts`

**Mirror structure of `buy-transaction.ts`:**

```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import idl from './target/idl/veritas_curation.json';

export interface SellParams {
  connection: Connection;
  seller: string;
  postId: string;
  tokenAmount: number;
  programId: string;
}

export async function buildSellTransaction(params: SellParams): Promise<Transaction> {
  const { connection, seller, postId, tokenAmount, programId } = params;

  const sellerPubkey = new PublicKey(seller);
  const programPubkey = new PublicKey(programId);

  // Create provider
  const provider = new AnchorProvider(
    connection,
    // @ts-ignore - Dummy wallet
    { publicKey: sellerPubkey, signTransaction: () => {}, signAllTransactions: () => {} },
    { commitment: 'confirmed' }
  );

  const program = new Program(idl as any, provider);

  // Derive PDAs
  const postIdBytes = Buffer.from(postId.replace(/-/g, ''), 'hex');
  const postIdBytes32 = Buffer.alloc(32);
  postIdBytes.copy(postIdBytes32, 0);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), postIdBytes32],
    programPubkey
  );

  const [tokenMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint'), postIdBytes32],
    programPubkey
  );

  const [poolVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), postIdBytes32],
    programPubkey
  );

  // Get user's token account (ATA)
  const sellerTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    sellerPubkey
  );

  // Get user's USDC account
  const usdcMint = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
  const sellerUsdcAccount = await getAssociatedTokenAddress(
    usdcMint,
    sellerPubkey
  );

  // Build sell instruction
  const transaction = await program.methods
    .sell(tokenAmount)
    .accounts({
      pool: poolPda,
      tokenMint: tokenMintPda,
      poolUsdcVault: poolVaultPda,
      sellerTokenAccount,
      sellerUsdcAccount,
      seller: sellerPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // Set recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sellerPubkey;

  return transaction;
}
```

#### Step 3.2: Create useSellTokens Hook
**File:** `src/hooks/useSellTokens.ts`

```typescript
import { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { buildSellTransaction } from '@/lib/solana/sell-transaction';
import { getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';

export function useSellTokens() {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sellTokens = async (postId: string, poolAddress: string, tokenAmount: number) => {
    if (!wallet || !address) {
      throw new Error('Wallet not connected');
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const rpcEndpoint = getRpcEndpoint();
      const programId = getProgramId().toString();
      const connection = new Connection(rpcEndpoint, 'confirmed');

      // Pre-fetch pool state BEFORE transaction
      const poolPda = /* derive pool PDA */;
      const poolAccountBefore = await connection.getAccountInfo(poolPda);
      const stateBefore = /* deserialize pool account */;

      // Build transaction
      const transaction = await buildSellTransaction({
        connection,
        seller: address,
        postId,
        tokenAmount,
        programId
      });

      // Sign transaction
      // @ts-ignore
      const signedTx = await wallet.signTransaction(transaction);

      // Send and confirm
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Fetch pool state AFTER transaction
      const poolAccountAfter = await connection.getAccountInfo(poolPda);
      const stateAfter = /* deserialize pool account */;

      // Record trade in database
      const jwt = await getAccessToken(); // from Privy
      await fetch('/api/supabase/functions/v1/solana-record-trade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          pool_address: poolAddress,
          post_id: postId,
          wallet_address: address,
          trade_type: 'sell',
          token_amount: tokenAmount.toString(),
          usdc_amount: /* calculate from curve */,
          token_supply_after: stateAfter.tokenSupply.toString(),
          reserve_after: stateAfter.reserve.toString(),
          k_quadratic: stateAfter.kQuadratic.toString(),
          tx_signature: signature
        })
      });

      return signature;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sell tokens');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { sellTokens, isLoading, error };
}
```

---

### **Phase 4: Update Buy to Record Trades** (Day 6)

#### Step 4.1: Update useBuyTokens
**File:** `src/hooks/useBuyTokens.ts`

**Add after transaction confirmation:**
```typescript
// After: await connection.confirmTransaction(signature, 'confirmed');

// Fetch pool state AFTER transaction
const poolPda = derivePoolPda(postId, programId);
const poolAccountAfter = await connection.getAccountInfo(poolPda);
const stateAfter = deserializePoolAccount(poolAccountAfter);

// Record trade
const jwt = await getAccessToken();
await fetch('/api/supabase/functions/v1/solana-record-trade', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: user.id,
    pool_address: poolPda.toBase58(),
    post_id: postId,
    wallet_address: address,
    trade_type: 'buy',
    token_amount: calculatedTokens.toString(),
    usdc_amount: usdcAmount.toString(),
    token_supply_after: stateAfter.tokenSupply.toString(),
    reserve_after: stateAfter.reserve.toString(),
    k_quadratic: stateAfter.kQuadratic.toString(),
    tx_signature: signature
  })
});
```

---

### **Phase 5: Epoch Processing Updates** (Day 7)

#### Step 5.1: Update Epoch Processing Function
**File:** `supabase/functions/protocol-epochs-process/index.ts`

**Add after belief aggregation:**
```typescript
// After computing delta_relevance, certainty, aggregate...

// Record belief history
await supabase.from('belief_relevance_history').insert({
  belief_id: belief.id,
  post_id: belief.post_id,
  epoch: currentEpoch,
  aggregate: belief.aggregate,
  delta_relevance: belief.delta_relevance,
  certainty: belief.certainty,
  disagreement_entropy: belief.disagreementEntropy,
  recorded_at: new Date().toISOString()
});
```

---

### **Phase 6: API Endpoints** (Day 8-9)

#### Step 6.1: Create GET /api/posts/[id]
**File:** `app/api/posts/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  // Fetch post with all related data
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      users:user_id (username, display_name, avatar_url),
      beliefs:belief_id (
        id,
        previous_aggregate,
        delta_relevance,
        certainty,
        expiration_epoch,
        status
      ),
      pool_deployments:pool_deployments!post_id (
        pool_address,
        token_mint_address,
        usdc_vault_address,
        token_supply,
        reserve,
        k_quadratic,
        last_synced_at
      )
    `)
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // If user authenticated, fetch their holdings
  const { data: { user } } = await supabase.auth.getUser();
  let userHoldings = null;

  if (user && post.pool_deployments?.[0]) {
    const { data } = await supabase
      .from('user_pool_balances')
      .select('token_balance, total_usdc_spent, total_bought')
      .eq('user_id', user.id)
      .eq('pool_address', post.pool_deployments[0].pool_address)
      .single();

    if (data) {
      const avgBuyPrice = data.total_bought > 0
        ? data.total_usdc_spent / data.total_bought
        : 0;

      userHoldings = {
        token_balance: data.token_balance,
        cost_basis: avgBuyPrice,
        total_invested: data.total_usdc_spent
      };
    }
  }

  return NextResponse.json({
    post,
    user_holdings: userHoldings
  });
}
```

#### Step 6.2: Create GET /api/posts/[id]/history
**File:** `app/api/posts/[id]/history/route.ts`

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  // Fetch belief history
  const { data: beliefHistory } = await supabase
    .from('belief_relevance_history')
    .select('epoch, aggregate, delta_relevance, certainty, recorded_at')
    .eq('post_id', params.id)
    .order('epoch', { ascending: true });

  // Fetch price history (from VIEW)
  const { data: priceHistory } = await supabase
    .from('pool_price_snapshots')
    .select('price, recorded_at, triggered_by')
    .eq('post_id', params.id)
    .order('recorded_at', { ascending: true });

  return NextResponse.json({
    belief_history: beliefHistory || [],
    price_history: priceHistory || []
  });
}
```

---

### **Phase 7: PostDetailView Component** (Day 10-12)

See `specs/ui-specs/pages/PostDetailView.md` for full spec.

**Key integration points:**
- Use `GET /api/posts/[id]` for data
- Use `GET /api/posts/[id]/history` for charts
- Use `useBuyTokens` and `useSellTokens` for trading
- Install Recharts: `npm install recharts`

---

## Testing Checklist

### Database
- [ ] All 3 tables created
- [ ] VIEW works and returns prices
- [ ] Trigger updates user_pool_balances correctly
- [ ] Indexes exist (check with `\di`)

### Edge Function
- [ ] solana-record-trade accepts valid trades
- [ ] Rejects duplicate tx_signature (unique constraint)
- [ ] Auto-updates user balance via trigger

### Buy/Sell
- [ ] Buy transaction executes on-chain
- [ ] Buy recorded in trades table
- [ ] User balance updated correctly
- [ ] Same for sell

### API
- [ ] /api/posts/[id] returns complete data
- [ ] /api/posts/[id]/history returns charts data
- [ ] User holdings shown when authenticated

### Charts
- [ ] Price history displays correctly
- [ ] Delta relevance history displays correctly
- [ ] Time axis formatted properly

---

## Performance Benchmarks

**Target performance:**
```sql
-- User trade history: <10ms
SELECT * FROM trades WHERE user_id = 'xxx' LIMIT 50;

-- Pool price chart: <50ms (VIEW), <10ms (if materialized)
SELECT * FROM pool_price_snapshots WHERE pool_address = 'xxx';

-- User balance lookup: <5ms
SELECT * FROM user_pool_balances WHERE user_id = 'xxx' AND pool_address = 'xxx';

-- Belief history: <20ms
SELECT * FROM belief_relevance_history WHERE post_id = 'xxx';
```

**If VIEW is slow, upgrade to MATERIALIZED VIEW:**
```sql
CREATE MATERIALIZED VIEW pool_price_snapshots_mv AS ...
REFRESH MATERIALIZED VIEW CONCURRENTLY pool_price_snapshots_mv;
```

---

## Migration File Location

**File:** `supabase/migrations/20250212_create_trading_tables_v2.sql`

---

## Summary of Changes from V1

### ✅ Improvements:
1. **3 tables instead of 4** (removed redundant `pool_price_history`)
2. **VIEW for prices** (derivable from trades)
3. **Renamed** `user_pool_positions` → `user_pool_balances` (clearer)
4. **Simplified `trades` table** (removed before state, only after)
5. **Denormalized `k_quadratic`** (avoid JOINs for price calc)

### ❌ Removed:
- Separate `pool_price_history` table
- `token_supply_before`, `reserve_before` columns
- `price_per_token` column (derivable)

### ✅ Kept:
- `trades` as immutable fact table
- `belief_relevance_history` (cannot be reconstructed)
- `user_pool_balances` (performance-critical aggregate)
- Auto-update trigger

---

**Status:** Ready to implement
**Next Step:** Create migration file and apply it

