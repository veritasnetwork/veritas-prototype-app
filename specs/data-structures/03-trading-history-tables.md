# Trading & History Tables Specification

## Overview
Tables for tracking historical pool state, belief metrics, and individual trades. Used for analytics charts and user transaction history.

---

## pool_price_history

Tracks token price snapshots **after every trade** (buy/sell).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique snapshot ID |
| pool_address | TEXT | References pool_deployments(pool_address) |
| post_id | UUID | References posts(id) for easier querying |
| price | NUMERIC | Token price in USDC (calculated from curve) |
| token_supply | NUMERIC | Total token supply at this snapshot |
| reserve | NUMERIC | Pool USDC reserve at this snapshot (micro-USDC) |
| recorded_at | TIMESTAMPTZ | Timestamp of snapshot (X-axis for charts) |
| triggered_by | TEXT | 'buy', 'sell', 'epoch', 'penalty', 'reward' |
| created_at | TIMESTAMPTZ | Row creation timestamp |

**Indexes:**
- `(pool_address, recorded_at DESC)` - For time-series queries
- `(post_id, recorded_at DESC)` - Alternative lookup by post
- `(recorded_at)` - For global price charts

**Notes:**
- Price calculated as: `reserve / (k_quadratic * supply^2)` if supply > 0
- Inserted automatically after every buy/sell transaction
- Also inserted after epoch processing (penalty/reward adjustments)
- `recorded_at` uses transaction timestamp for chronological ordering

---

## belief_relevance_history

Tracks belief metrics **after every epoch processing**.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique snapshot ID |
| belief_id | UUID | References beliefs(id) |
| epoch | INTEGER | Epoch number when recorded |
| aggregate | NUMERIC | Absolute BD relevance score (0-1) used for pool settlement |
| certainty | NUMERIC | Certainty score (0-1) |
| disagreement_entropy | NUMERIC | Entropy metric from BD/aggregation |
| participant_count | INTEGER | Number of active participants this epoch |
| total_stake | NUMERIC | Sum of effective stakes allocated to this belief |
| recorded_at | TIMESTAMPTZ | Timestamp of epoch completion |

**Indexes:**
- `(belief_id, epoch DESC)` - Primary query pattern
- `(post_id, epoch DESC)` - Alternative lookup by post
- `(epoch, recorded_at)` - Global epoch analysis

**Unique Constraint:**
- `UNIQUE(belief_id, epoch)` - One record per belief per epoch

**Notes:**
- Inserted by epoch processing function after belief decomposition/aggregation
- `recorded_at` = timestamp when epoch processing completed
- `aggregate` is absolute BD relevance score used for pool settlement
- No longer tracks `delta_relevance` (deprecated concept)
- Enables relevance history chart in PostDetailView

---

## trades

Tracks every individual trade (buy/sell LONG/SHORT tokens or liquidity provision) for audit trail and user history. Updated for ICBS two-sided markets.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique trade ID |
| pool_address | TEXT | References pool_deployments(pool_address) |
| post_id | UUID | References posts(id) |
| user_id | UUID | References users(id) who executed trade |
| wallet_address | TEXT | Solana wallet address of trader |
| trade_type | TEXT | 'buy', 'sell', or 'liquidity_provision' |
| side | TEXT | 'LONG' or 'SHORT' - which token was traded |
| token_amount | NUMERIC | Number of tokens bought/sold |
| usdc_amount | NUMERIC | USDC spent (buy) or received (sell) in atomic units |
| price_per_token | NUMERIC | Effective price per token in this trade |
| tx_signature | TEXT | Solana transaction signature (unique) |
| recorded_at | TIMESTAMPTZ | Timestamp of transaction |
| created_at | TIMESTAMPTZ | Row creation timestamp |
| **ICBS Fields** | | **Added for two-sided markets** |
| f | INTEGER | ICBS growth exponent at time of trade |
| beta_num | INTEGER | ICBS β numerator at time of trade |
| beta_den | INTEGER | ICBS β denominator at time of trade |
| sqrt_price_long_x96 | TEXT | LONG token sqrt price in X96 format (from on-chain event) |
| sqrt_price_short_x96 | TEXT | SHORT token sqrt price in X96 format (from on-chain event) |
| price_long | NUMERIC | LONG token price in USDC (human-readable) |
| price_short | NUMERIC | SHORT token price in USDC (human-readable) |
| **Event Indexer Fields** | | **For dual-source tracking** |
| recorded_by | TEXT | 'server' (API) or 'indexer' (event processor) |
| confirmed | BOOLEAN | Whether on-chain event has verified this transaction |
| indexer_corrected | BOOLEAN | Did indexer overwrite incorrect server data |
| server_amount | NUMERIC | Original server amount if indexer corrected it |
| confirmed_at | TIMESTAMPTZ | When indexer confirmed this trade |
| indexed_at | TIMESTAMPTZ | When event was indexed from blockchain |
| block_time | TIMESTAMPTZ | Blockchain timestamp of transaction |
| slot | BIGINT | Solana slot number |

**Indexes:**
- `(user_id, recorded_at DESC)` - User's trade history
- `(pool_address, recorded_at DESC)` - Pool's trade history
- `(post_id, recorded_at DESC)` - Post's trade history
- `(tx_signature)` - Unique lookup by transaction
- `(recorded_at DESC)` - Global trade feed
- `(confirmed)` WHERE NOT confirmed - Unconfirmed trades monitoring
- `(block_time)` WHERE block_time IS NOT NULL - Blockchain metadata

**Unique Constraint:**
- `UNIQUE(tx_signature)` - Prevent duplicate trades

**ICBS Trade Types:**
- `buy` + `side='LONG'` - Buying LONG tokens (bullish on post relevance)
- `buy` + `side='SHORT'` - Buying SHORT tokens (bearish on post relevance)
- `sell` + `side='LONG'` - Selling LONG tokens
- `sell` + `side='SHORT'` - Selling SHORT tokens
- `liquidity_provision` - Initial market deployment (creates both LONG + SHORT)

**Dual-Source Event Tracking:**
- Trades can be recorded by server-side API first (`recorded_by='server'`)
- Event indexer later confirms and updates `confirmed=true`
- If amounts differ, indexer corrects and sets `indexer_corrected=true`
- Original server amount preserved in `server_amount` for reconciliation

**Notes:**
- `price_per_token` = `usdc_amount / token_amount` (effective average price)
- `usdc_amount` stored in micro-USDC (6 decimals), display as USDC in UI
- ICBS prices stored both as sqrt_price (on-chain format) and decimal (UI format)
- Liquidity provision trades don't affect user position summary (neutral/hedged)
- Used for:
  - User portfolio tracking
  - Pool volume calculations
  - Trade history display
  - Cost basis calculations
  - Event reconciliation between server and blockchain

---

## settlements

Tracks epoch settlement events for pools (when BD scores adjust reserves).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique settlement ID |
| pool_address | TEXT | References pool_deployments(pool_address) |
| post_id | UUID | References posts(id) |
| belief_id | UUID | References beliefs(id) |
| epoch | INTEGER | Epoch number when settled |
| bd_score | NUMERIC | Belief decomposition relevance score (0-1) |
| market_prediction | NUMERIC | Market's prediction (q_long from pool state) |
| settlement_factor_long | NUMERIC | Adjustment factor for LONG reserves (f_L) |
| settlement_factor_short | NUMERIC | Adjustment factor for SHORT reserves (f_S) |
| s_long_before | NUMERIC | LONG reserve before settlement (micro-USDC) |
| s_short_before | NUMERIC | SHORT reserve before settlement (micro-USDC) |
| s_long_after | NUMERIC | LONG reserve after settlement (micro-USDC) |
| s_short_after | NUMERIC | SHORT reserve after settlement (micro-USDC) |
| tx_signature | TEXT | Solana transaction signature |
| settled_at | TIMESTAMPTZ | Timestamp of settlement transaction |
| created_at | TIMESTAMPTZ | Row creation timestamp |
| **Event Indexer Fields** | | |
| event_slot | BIGINT | Solana slot number |
| event_signature | TEXT | On-chain event signature (for verification) |

**Indexes:**
- `(pool_address, epoch DESC)` - Pool settlement history
- `(epoch, settled_at)` - Global epoch settlements
- `(tx_signature)` - Unique transaction lookup

**Unique Constraint:**
- `UNIQUE(pool_address, epoch)` - One settlement per pool per epoch

**Notes:**
- Settlement factors calculated as: `f_L = bd_score / market_prediction`, `f_S = (1 - bd_score) / (1 - market_prediction)`
- Reserves scale by factors: `s_long_after = s_long_before * f_L`
- Total USDC in pool conserved: `s_long_after + s_short_after = s_long_before + s_short_before`
- Accurate market predictions → factors close to 1.0 (minimal change)
- Inaccurate predictions → reserves shift dramatically (traders lose value)
- Used for settlement history charts and pool performance analytics

---

## user_pool_positions

Tracks user's current holdings and cost basis per pool (aggregated from trades).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique position ID |
| user_id | UUID | References users(id) |
| pool_address | TEXT | References pool_deployments(pool_address) |
| post_id | UUID | References posts(id) |
| token_balance | NUMERIC | Current token balance (NOT on-chain, calculated) |
| total_bought | NUMERIC | Lifetime tokens bought |
| total_sold | NUMERIC | Lifetime tokens sold |
| total_usdc_spent | NUMERIC | Lifetime USDC spent on buys (micro-USDC) |
| total_usdc_received | NUMERIC | Lifetime USDC received from sells (micro-USDC) |
| avg_buy_price | NUMERIC | Average price paid per token |
| realized_pnl | NUMERIC | Profit/loss from sold tokens (USDC) |
| unrealized_pnl | NUMERIC | Profit/loss on current holdings (updated periodically) |
| first_trade_at | TIMESTAMPTZ | When user first traded this pool |
| last_trade_at | TIMESTAMPTZ | When user last traded this pool |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `(user_id, pool_address)` - Primary lookup pattern
- `(user_id, updated_at DESC)` - User's active positions
- `(pool_address, token_balance DESC)` - Leaderboard by holdings

**Unique Constraint:**
- `UNIQUE(user_id, pool_address)` - One position per user per pool

**Notes:**
- `token_balance` = `total_bought - total_sold` (calculated, not on-chain)
- Should periodically sync with on-chain balance for verification
- `avg_buy_price` = `total_usdc_spent / total_bought`
- `realized_pnl` = `total_usdc_received - (avg_buy_price * total_sold)`
- `unrealized_pnl` = `(current_price * token_balance) - (avg_buy_price * token_balance)`
- Updated via triggers on `trades` table or periodic batch job

---

## Data Flow

### After Buy Transaction:

```typescript
1. User executes buy on Solana
2. Transaction confirmed with signature
3. Backend receives webhook/polling notification
4. Insert into `trades` table:
   - Record token_amount, usdc_amount, price
   - Snapshot supply/reserve before & after
5. Insert into `pool_price_history` table:
   - Calculate new price from updated supply/reserve
   - triggered_by = 'buy'
6. Upsert `user_pool_positions`:
   - Increment token_balance
   - Increment total_bought, total_usdc_spent
   - Recalculate avg_buy_price
```

### After Sell Transaction:

```typescript
1. User executes sell on Solana
2. Transaction confirmed
3. Insert into `trades` table:
   - Record token_amount, usdc_amount, price
   - Snapshot supply/reserve before & after
4. Insert into `pool_price_history` table:
   - Calculate new price
   - triggered_by = 'sell'
5. Update `user_pool_positions`:
   - Decrement token_balance
   - Increment total_sold, total_usdc_received
   - Calculate realized_pnl
```

### After Epoch Processing:

```typescript
1. Epoch processing completes
2. For each belief market:
   - Insert into `belief_relevance_history`:
     - epoch, aggregate (absolute BD relevance), certainty, disagreement_entropy
     - participant_count, total_stake
     - recorded_at = NOW()
3. Pool settlement (separate step):
   - For each pool, execute settle_epoch with BD score
   - Settlement events indexed to `settlements` table
   - No direct price history update (pools settle independently)
```

---

## Migration File

**Filename:** `supabase/migrations/20250212_create_trading_history_tables.sql`

```sql
-- ============================================================================
-- Trading & History Tables
-- ============================================================================
-- Tracks pool price snapshots, belief relevance over time, and trade history
-- ============================================================================

BEGIN;

-- Pool Price History (after every trade)
CREATE TABLE pool_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  token_supply NUMERIC NOT NULL CHECK (token_supply >= 0),
  reserve NUMERIC NOT NULL CHECK (reserve >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('buy', 'sell', 'epoch', 'penalty', 'reward')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pool_price_history_pool_time ON pool_price_history(pool_address, recorded_at DESC);
CREATE INDEX idx_pool_price_history_post_time ON pool_price_history(post_id, recorded_at DESC);
CREATE INDEX idx_pool_price_history_time ON pool_price_history(recorded_at DESC);

-- Belief Relevance History (after every epoch)
CREATE TABLE belief_relevance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  aggregate NUMERIC NOT NULL CHECK (aggregate >= 0 AND aggregate <= 1),
  delta_relevance NUMERIC NOT NULL CHECK (delta_relevance >= -1 AND delta_relevance <= 1),
  certainty NUMERIC NOT NULL CHECK (certainty >= 0 AND certainty <= 1),
  disagreement_entropy NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(belief_id, epoch)
);

CREATE INDEX idx_belief_history_belief_epoch ON belief_relevance_history(belief_id, epoch DESC);
CREATE INDEX idx_belief_history_post_epoch ON belief_relevance_history(post_id, epoch DESC);
CREATE INDEX idx_belief_history_epoch_time ON belief_relevance_history(epoch, recorded_at);

-- Individual Trades
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  token_amount NUMERIC NOT NULL CHECK (token_amount > 0),
  usdc_amount NUMERIC NOT NULL CHECK (usdc_amount > 0),
  price_per_token NUMERIC NOT NULL CHECK (price_per_token > 0),
  token_supply_before NUMERIC NOT NULL,
  token_supply_after NUMERIC NOT NULL,
  reserve_before NUMERIC NOT NULL,
  reserve_after NUMERIC NOT NULL,
  tx_signature TEXT NOT NULL UNIQUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user_time ON trades(user_id, recorded_at DESC);
CREATE INDEX idx_trades_pool_time ON trades(pool_address, recorded_at DESC);
CREATE INDEX idx_trades_post_time ON trades(post_id, recorded_at DESC);
CREATE INDEX idx_trades_tx ON trades(tx_signature);
CREATE INDEX idx_trades_time ON trades(recorded_at DESC);

-- User Pool Positions (aggregated)
CREATE TABLE user_pool_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  token_balance NUMERIC NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
  total_bought NUMERIC NOT NULL DEFAULT 0,
  total_sold NUMERIC NOT NULL DEFAULT 0,
  total_usdc_spent NUMERIC NOT NULL DEFAULT 0,
  total_usdc_received NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pool_address)
);

CREATE INDEX idx_positions_user_pool ON user_pool_positions(user_id, pool_address);
CREATE INDEX idx_positions_user_updated ON user_pool_positions(user_id, updated_at DESC);
CREATE INDEX idx_positions_pool_balance ON user_pool_positions(pool_address, token_balance DESC);

-- Function to update position after trade
CREATE OR REPLACE FUNCTION update_user_position_after_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_current_price NUMERIC;
BEGIN
  -- Upsert user position
  INSERT INTO user_pool_positions (
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
    token_balance = user_pool_positions.token_balance +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    total_bought = user_pool_positions.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_positions.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_positions.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_positions.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  -- Update calculated fields
  UPDATE user_pool_positions
  SET
    avg_buy_price = CASE
      WHEN total_bought > 0 THEN total_usdc_spent / total_bought
      ELSE 0
    END,
    realized_pnl = total_usdc_received -
      (CASE WHEN total_bought > 0 THEN (total_usdc_spent / total_bought) * total_sold ELSE 0 END)
  WHERE user_id = NEW.user_id AND pool_address = NEW.pool_address;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update positions
CREATE TRIGGER trg_update_position_after_trade
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_position_after_trade();

COMMIT;
```

---

**Last Updated:** October 7, 2025
**Status:** Ready for implementation
**Dependencies:** Requires updates to buy/sell hooks and epoch processing function
