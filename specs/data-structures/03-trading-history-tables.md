# Trading & History Tables Specification

## Overview
Tables for tracking trades, user positions, and pool history. Uses ICBS (Informed Constant β-Sum) two-sided markets with LONG/SHORT tokens.

---

## trades
Tracks every individual trade (buy/sell LONG/SHORT tokens) for audit trail and user history.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique trade ID |
| pool_address | text | NOT NULL, FOREIGN KEY → pool_deployments CASCADE | Pool where trade occurred |
| post_id | uuid | NOT NULL, FOREIGN KEY → posts(id) CASCADE | Associated post |
| user_id | uuid | NOT NULL, FOREIGN KEY → users(id) CASCADE | User who executed trade |
| wallet_address | text | NOT NULL | Solana wallet address of trader |
| trade_type | text | NOT NULL, CHECK | 'buy', 'sell', or 'liquidity_provision' |
| side | text | CHECK | 'LONG' or 'SHORT' - which token was traded |
| token_amount | numeric | NOT NULL, CHECK > 0 | Number of tokens bought/sold (display units) |
| usdc_amount | numeric | NOT NULL, CHECK > 0 | USDC spent/received (MICRO-USDC) |
| token_supply_after | numeric | CHECK >= 0 | Token supply after trade (legacy field) |
| reserve_after | numeric | CHECK >= 0 | Reserve after trade (legacy field) |
| tx_signature | text | NOT NULL, UNIQUE | Solana transaction signature |
| recorded_at | timestamptz | NOT NULL, DEFAULT now() | When trade was recorded |
| created_at | timestamptz | DEFAULT now() | Row creation timestamp |
| **Event Indexer Fields** | | | |
| recorded_by | text | DEFAULT 'server', CHECK | Source: "server" or "indexer" |
| confirmed | boolean | DEFAULT false | Whether on-chain event verified |
| server_amount | numeric | | Original server amount if indexer corrected it |
| indexer_corrected | boolean | DEFAULT false | Did indexer overwrite server data |
| confirmed_at | timestamptz | | When indexer confirmed this trade |
| indexed_at | timestamptz | | When event was indexed from blockchain |
| block_time | timestamptz | | Blockchain timestamp of transaction |
| slot | bigint | | Solana slot number |
| **ICBS Fields** | | | |
| f | integer | | ICBS growth exponent at time of trade |
| beta_num | integer | | ICBS β numerator at time of trade |
| beta_den | integer | | ICBS β denominator at time of trade |
| sqrt_price_long_x96 | text | | LONG sqrt price in Q64.96 format (from event) |
| sqrt_price_short_x96 | text | | SHORT sqrt price in Q64.96 format (from event) |
| price_long | numeric | | LONG token price in USDC (display units) |
| price_short | numeric | | SHORT token price in USDC (display units) |
| **Pool State Snapshots** | | | |
| s_long_before | numeric | | LONG supply before trade (display units) |
| s_long_after | numeric | | LONG supply after trade (display units) |
| s_short_before | numeric | | SHORT supply before trade (display units) |
| s_short_after | numeric | | SHORT supply after trade (display units) |
| r_long_before | numeric | | LONG virtual reserve before trade |
| r_long_after | numeric | | LONG virtual reserve after trade |
| r_short_before | numeric | | SHORT virtual reserve before trade |
| r_short_after | numeric | | SHORT virtual reserve after trade |

**Indexes:**
- `trades_pkey` (PRIMARY KEY on id)
- `trades_tx_signature_key` (UNIQUE on tx_signature)
- `idx_trades_user_time` (on user_id, recorded_at DESC)
- `idx_trades_pool_time` (on pool_address, recorded_at DESC)
- `idx_trades_post_time` (on post_id, recorded_at DESC)
- `idx_trades_post_recorded_at` (on post_id, recorded_at DESC)
- `idx_trades_tx` (on tx_signature)
- `idx_trades_time` (on recorded_at DESC)
- `idx_trades_confirmed` (on confirmed WHERE NOT confirmed)
- `idx_trades_block_time` (on block_time WHERE NOT NULL)
- `idx_trades_side` (on side WHERE side IS NOT NULL)
- `idx_trades_long` (on pool_address, recorded_at DESC WHERE side = 'LONG')
- `idx_trades_short` (on pool_address, recorded_at DESC WHERE side = 'SHORT')

**Triggers:**
- `trg_update_balance_after_trade_safe` - Updates user_pool_balances after trade insert

**IMPORTANT UNITS:**
- `usdc_amount`: MICRO-USDC (e.g., 10000000 = $10.00)
- `token_amount`: DISPLAY units (e.g., 100.5 tokens)
- `price_long`, `price_short`: DISPLAY units (USDC per token)
- `s_long_*`, `s_short_*`, `r_long_*`, `r_short_*`: DISPLAY units

**Trade Types:**
- `buy` + `side='LONG'` - Buying LONG tokens (bullish on post relevance)
- `buy` + `side='SHORT'` - Buying SHORT tokens (bearish on post relevance)
- `sell` + `side='LONG'` - Selling LONG tokens
- `sell` + `side='SHORT'` - Selling SHORT tokens
- `liquidity_provision` - Initial market deployment (creates both LONG + SHORT)

**Dual-Source Event Tracking:**
- Trades recorded by server-side API first (`recorded_by='server'`)
- Event indexer later confirms and updates `confirmed=true`
- If amounts differ, indexer corrects and sets `indexer_corrected=true`
- Original server amount preserved in `server_amount` for reconciliation

---

## user_pool_balances
Tracks user's current holdings and cost basis per pool per token type (LONG/SHORT).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY on (user_id, pool_address, token_type) | Composite primary key |
| user_id | uuid | NOT NULL, FOREIGN KEY → users(id) CASCADE | User holding tokens |
| pool_address | text | NOT NULL, FOREIGN KEY → pool_deployments CASCADE | Pool where tokens are held |
| post_id | uuid | NOT NULL, FOREIGN KEY → posts(id) CASCADE | Associated post |
| token_type | text | NOT NULL, DEFAULT 'LONG', CHECK | 'LONG' or 'SHORT' |
| token_balance | numeric | NOT NULL, DEFAULT 0, CHECK >= 0 | Current token balance (display units) |
| total_bought | numeric | NOT NULL, DEFAULT 0 | Lifetime tokens bought (display units) |
| total_sold | numeric | NOT NULL, DEFAULT 0 | Lifetime tokens sold (display units) |
| total_usdc_spent | numeric | NOT NULL, DEFAULT 0 | Lifetime USDC spent on buys (MICRO-USDC) |
| total_usdc_received | numeric | NOT NULL, DEFAULT 0 | Lifetime USDC received from sells (MICRO-USDC) |
| first_trade_at | timestamptz | | When user first traded this pool/side |
| last_trade_at | timestamptz | | When user last traded this pool/side |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |
| last_buy_amount | bigint | NOT NULL, DEFAULT 0 | Last buy amount (legacy field) |
| belief_lock | bigint | NOT NULL, DEFAULT 0, CHECK >= 0 | Locked stake (DISPLAY USDC) |
| net_bought | numeric | NOT NULL, DEFAULT 0 | Net tokens bought minus sold |
| realized_pnl | numeric | DEFAULT 0 | Profit/loss from sold tokens (display USDC) |
| entry_price | numeric | | Average entry price (display USDC per token) |

**Indexes:**
- `user_pool_balances_pkey` (PRIMARY KEY on user_id, pool_address, token_type)
- `user_pool_balances_user_pool_side_key` (UNIQUE on user_id, pool_address, token_type)
- `idx_balances_user` (on user_id)
- `idx_balances_user_pool` (on user_id, pool_address)
- `idx_balances_pool_balance` (on pool_address, token_balance DESC)
- `idx_user_pool_balances_user_open` (on user_id, pool_address, token_type WHERE token_balance > 0)

**IMPORTANT UNITS:**
- `token_balance`, `total_bought`, `total_sold`, `net_bought`: DISPLAY units (tokens)
- `total_usdc_spent`, `total_usdc_received`: MICRO-USDC
- `belief_lock`: DISPLAY USDC (not micro!)
- `realized_pnl`: DISPLAY USDC
- `entry_price`: DISPLAY units (USDC per token)

**Notes:**
- One row per user per pool per token type (LONG/SHORT are separate positions)
- `token_balance` = `total_bought - total_sold` (calculated, not on-chain)
- `entry_price` calculated on first buy, updated on position re-entry
- `belief_lock` represents 2% of initial position (released on full exit)
- Updated automatically via trigger when trades are inserted
- Used for:
  - User portfolio tracking
  - Holdings display on profile pages
  - Cost basis calculations
  - PnL tracking

**Calculation Formulas:**
```sql
-- Entry price (weighted average of buys)
entry_price = total_usdc_spent / total_bought  -- Both in display units after conversion

-- Realized PnL (from sells)
realized_pnl = (sell_price - entry_price) * tokens_sold

-- Unrealized PnL (current position)
unrealized_pnl = (current_price - entry_price) * token_balance
```

---

## Data Flow

### After Buy Transaction:

```typescript
1. User executes buy on Solana (via useBuyTokens hook)
2. Transaction confirmed with signature
3. Frontend calls /api/trades/record:
   - Records trade with usdc_amount (converted display → micro-USDC)
   - Stores pool state snapshots (supply, reserves, prices)
   - recorded_by = 'server', confirmed = false
4. RPC function record_trade_atomic:
   - Inserts into trades table (usdc_amount in micro-USDC)
   - Upserts user_pool_balances:
     - Increment token_balance
     - Increment total_bought, total_usdc_spent (micro-USDC)
     - Set/update entry_price
     - Set belief_lock (2% of trade in display USDC)
   - Inserts belief_submission (for protocol scoring)
   - Inserts implied_relevance_history
5. Trigger updates pool_deployments:
   - Update sqrt prices, supplies
   - Update last_synced_at
6. Event indexer eventually confirms:
   - Sets confirmed = true
   - Updates block_time, slot, indexed_at
   - Corrects amounts if different
```

### After Sell Transaction:

```typescript
1. User executes sell on Solana (via useSellTokens hook)
2. Transaction confirmed
3. Frontend calls /api/trades/record:
   - Records trade with usdc_amount (micro-USDC)
   - Stores pool state snapshots
4. RPC function record_trade_atomic:
   - Inserts into trades table
   - Updates user_pool_balances:
     - Decrement token_balance
     - Increment total_sold, total_usdc_received (micro-USDC)
     - Calculate realized_pnl
     - If token_balance = 0: release belief_lock
     - Else: keep existing lock
5. Trigger updates pool_deployments
6. Event indexer confirms later
```

### After Epoch Settlement:

```typescript
1. Epoch processing calculates BD relevance scores
2. For each belief:
   - Insert into belief_relevance_history:
     - epoch, aggregate, certainty, disagreement_entropy
     - recorded_at = NOW()
3. Pool settlement (via Solana settle_epoch instruction):
   - Reserves scale based on BD score vs market prediction
   - Event indexer records in settlements table:
     - bd_relevance_score, market_prediction_q
     - f_long, f_short (settlement factors)
     - reserve_long_before/after, reserve_short_before/after
   - Pool token values adjust automatically
   - User positions gain/lose value proportionally
```

---

**Units Reference Card:**

| Table | Column | Units |
|-------|--------|-------|
| trades | usdc_amount | MICRO-USDC |
| trades | token_amount | DISPLAY |
| trades | price_long/price_short | DISPLAY (USDC/token) |
| trades | s_long_*/s_short_* | DISPLAY |
| user_pool_balances | total_usdc_spent | MICRO-USDC |
| user_pool_balances | total_usdc_received | MICRO-USDC |
| user_pool_balances | token_balance | DISPLAY |
| user_pool_balances | belief_lock | DISPLAY USDC |
| user_pool_balances | entry_price | DISPLAY (USDC/token) |
| user_pool_balances | realized_pnl | DISPLAY USDC |
| pool_deployments | s_long_supply/s_short_supply | DISPLAY |
| pool_deployments | vault_balance | MICRO-USDC |
| pool_deployments | cached_price_* | DISPLAY (USDC/token) |
| posts | total_volume_usdc | MICRO-USDC |

**Conversion:**
- Micro-USDC → Display USDC: `value / 1_000_000`
- Display USDC → Micro-USDC: `value * 1_000_000`

---

**Last Updated:** October 25, 2025
**Status:** Current schema after all migrations applied
