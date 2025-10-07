# Data Architecture Analysis - Trading History
## Elite Data Engineering Perspective

---

## Current Proposed Schema (4 Tables)

```
pool_price_history      - Time-series snapshots per pool
belief_relevance_history - Time-series snapshots per belief
trades                  - Individual transactions (fact table)
user_pool_positions     - Aggregated user holdings (materialized view)
```

---

## Critical Questions

### 1. **Will these tables store data for ALL pools and ALL users?**
**Answer:** YES. This is correct and necessary.

**Reasoning:**
- **Single table per entity type** = simpler queries, better indexing
- **Partitioning becomes possible** as data grows
- **Analytics-friendly** for cross-pool/cross-user analysis

**Anti-pattern to avoid:**
- ❌ One table per pool (scaling nightmare)
- ❌ One table per user (query hell)
- ❌ Separate tables per time range (manual management)

---

## Schema Evaluation

### ✅ **KEEP: `trades` (Fact Table)**

**Why:**
- Core immutable facts: who, what, when, how much
- Source of truth for all analytics
- Enables event sourcing & audit trail
- Can reconstruct any aggregation

**Pattern:** [Kimball Fact Table](https://en.wikipedia.org/wiki/Fact_table)
- Grain: One row per trade transaction
- Foreign keys: user_id, pool_address, post_id
- Measures: token_amount, usdc_amount, price
- Dimensions: time (recorded_at), type (buy/sell)

**Indexes needed:**
```sql
(user_id, recorded_at DESC)     -- User trade history
(pool_address, recorded_at DESC) -- Pool trade history
(recorded_at DESC)               -- Global feed
(tx_signature) UNIQUE            -- Deduplication
```

**Growth rate:** ~1-100 rows/minute (low)
**Retention:** Forever (immutable historical record)

---

### 🤔 **RECONSIDER: `pool_price_history`**

**Current design:** Snapshot after every trade + epoch event

**Problem:** This is **redundant** - we can calculate price from `trades`!

**Better approach:** Calculated view or materialized view

#### Option A: Calculated View (Recommended)
```sql
CREATE VIEW pool_price_snapshots AS
SELECT
  pool_address,
  post_id,
  reserve_after / (k_quadratic * POWER(token_supply_after, 2)) as price,
  token_supply_after as token_supply,
  reserve_after as reserve,
  recorded_at,
  trade_type as triggered_by
FROM trades
UNION ALL
SELECT
  pool_address,
  post_id,
  price,
  token_supply,
  reserve,
  recorded_at,
  'epoch' as triggered_by
FROM epoch_pool_snapshots; -- Only for penalty/reward events
```

**Pros:**
- ✅ No duplicate data
- ✅ Always accurate (derived from source)
- ✅ No insert overhead on trades

**Cons:**
- ❌ Slower queries (must calculate on-read)
- ❌ No indexes on calculated columns

#### Option B: Materialized View (Better for Analytics)
```sql
CREATE MATERIALIZED VIEW pool_price_history_mv AS
-- Same query as above
WITH DATA;

CREATE INDEX idx_price_mv_pool_time ON pool_price_history_mv(pool_address, recorded_at DESC);

-- Refresh after trades or on schedule
REFRESH MATERIALIZED VIEW CONCURRENTLY pool_price_history_mv;
```

**Pros:**
- ✅ Fast queries (pre-computed)
- ✅ Indexable
- ✅ No duplicate storage (conceptually)

**Cons:**
- ❌ Requires refresh trigger/cron
- ❌ Slight complexity

#### Option C: Keep Separate Table (Current Design)
**When justified:**
- If you need **sub-second query latency** for charts
- If refresh overhead is too high
- If you add non-derivable metadata (e.g., external price feeds)

**My recommendation:** Start with **regular table** for simplicity, migrate to materialized view if performance is good enough.

---

### 🤔 **RECONSIDER: `belief_relevance_history`**

**Current design:** Snapshot after every epoch

**Analysis:** This is **NOT redundant** - belief metrics can't be reconstructed from trades.

**However...**

#### Is this the right granularity?

**Alternative 1:** Store in `beliefs` table with versioning
```sql
ALTER TABLE beliefs ADD COLUMN history JSONB[];

-- After each epoch, append to array
UPDATE beliefs
SET history = array_append(history, jsonb_build_object(
  'epoch', 42,
  'aggregate', 0.67,
  'delta_relevance', 0.12,
  'certainty', 0.85,
  'recorded_at', NOW()
))
WHERE id = $belief_id;
```

**Pros:**
- ✅ Keeps belief data together
- ✅ One row per belief (not 100+ for 100 epochs)
- ✅ JSONB is queryable and indexable

**Cons:**
- ❌ Array grows forever (but manageable, ~10KB for 100 epochs)
- ❌ Less SQL-friendly for time-series queries
- ❌ Need JSONB unnest for analytics

**Alternative 2:** Keep separate table (Current design)
**When justified:**
- If you need SQL window functions over time
- If you want to partition by epoch
- If you do time-series analytics frequently

**My recommendation:** **Keep separate table** - time-series analytics are core to your product.

---

### ✅ **KEEP: `user_pool_positions` (Materialized Aggregate)**

**Why:**
- Expensive to calculate on-the-fly (aggregate all trades)
- Queried frequently (every page load)
- Low cardinality (users × pools, not trades)

**Pattern:** [Materialized Aggregate](https://en.wikipedia.org/wiki/Materialized_view)

**Alternative considered:** Calculate from `trades` on-read
```sql
SELECT
  user_id,
  pool_address,
  SUM(CASE WHEN trade_type = 'buy' THEN token_amount ELSE -token_amount END) as balance,
  SUM(CASE WHEN trade_type = 'buy' THEN usdc_amount ELSE 0 END) /
    NULLIF(SUM(CASE WHEN trade_type = 'buy' THEN token_amount ELSE 0 END), 0) as avg_price
FROM trades
GROUP BY user_id, pool_address;
```

**Problem:** This query is O(n) on trades, gets slower over time.

**My recommendation:** **Keep separate table with trigger** - fast reads are critical for UX.

---

## Optimal Architecture (Revised)

### Core Tables (3)

#### 1. **`trades`** (Fact Table - Source of Truth)
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  pool_address TEXT NOT NULL,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  token_amount NUMERIC NOT NULL,
  usdc_amount NUMERIC NOT NULL,
  -- Snapshot pool state AFTER this trade
  token_supply_after NUMERIC NOT NULL,
  reserve_after NUMERIC NOT NULL,
  k_quadratic NUMERIC NOT NULL, -- Denormalize for price calculation
  tx_signature TEXT NOT NULL UNIQUE,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Essential indexes for access patterns
CREATE INDEX idx_trades_user_time ON trades(user_id, recorded_at DESC);
CREATE INDEX idx_trades_pool_time ON trades(pool_address, recorded_at DESC);
CREATE INDEX idx_trades_time ON trades(recorded_at DESC);
```

**Key changes:**
- ❌ Removed `price_per_token` (derivable: `usdc_amount / token_amount`)
- ❌ Removed `token_supply_before`, `reserve_before` (not needed for analytics)
- ✅ Added `k_quadratic` (denormalized for price calculation without JOIN)
- ✅ Simplified to essential fields

**Growth:** 1KB per row × 1M trades/year = 1GB/year (manageable)

---

#### 2. **`belief_relevance_history`** (Time-Series Table)
```sql
CREATE TABLE belief_relevance_history (
  id UUID PRIMARY KEY,
  belief_id UUID NOT NULL,
  post_id UUID NOT NULL,
  epoch INTEGER NOT NULL,
  aggregate NUMERIC NOT NULL,
  delta_relevance NUMERIC NOT NULL,
  certainty NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  UNIQUE(belief_id, epoch)
);

CREATE INDEX idx_belief_history_belief_epoch ON belief_relevance_history(belief_id, epoch DESC);
CREATE INDEX idx_belief_history_post_epoch ON belief_relevance_history(post_id, epoch DESC);
```

**Keep as-is** - essential for delta relevance charts.

**Growth:** 100 bytes × 10K beliefs × 100 epochs = 100MB (tiny)

---

#### 3. **`user_pool_positions`** (Aggregate Table)
```sql
CREATE TABLE user_pool_positions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  pool_address TEXT NOT NULL,
  post_id UUID NOT NULL,
  token_balance NUMERIC NOT NULL DEFAULT 0,
  total_bought NUMERIC NOT NULL DEFAULT 0,
  total_sold NUMERIC NOT NULL DEFAULT 0,
  total_usdc_spent NUMERIC NOT NULL DEFAULT 0,
  total_usdc_received NUMERIC NOT NULL DEFAULT 0,
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pool_address)
);

CREATE INDEX idx_positions_user ON user_pool_positions(user_id);
CREATE INDEX idx_positions_pool_balance ON user_pool_positions(pool_address, token_balance DESC);
```

**Calculated fields** (via trigger or query):
- `avg_buy_price = total_usdc_spent / NULLIF(total_bought, 0)`
- `realized_pnl = total_usdc_received - (avg_buy_price * total_sold)`
- `unrealized_pnl = (current_price * token_balance) - (avg_buy_price * token_balance)`

**Growth:** 200 bytes × 10K users × 100 pools = 200MB (small)

---

### Derived Views (2)

#### 4. **`pool_price_snapshots`** (Materialized View - Optional)

**If query performance is good enough, use a VIEW:**
```sql
CREATE VIEW pool_price_snapshots AS
SELECT
  pool_address,
  post_id,
  reserve_after / NULLIF(k_quadratic * POWER(token_supply_after, 2), 0) as price,
  token_supply_after as token_supply,
  reserve_after as reserve,
  recorded_at,
  'trade' as source
FROM trades
ORDER BY pool_address, recorded_at;
```

**If you need fast queries, materialize it:**
```sql
CREATE MATERIALIZED VIEW pool_price_history_mv AS
SELECT ... -- same query

CREATE INDEX idx_price_mv_pool_time ON pool_price_history_mv(pool_address, recorded_at DESC);

-- Refresh after trades (can be async)
CREATE OR REPLACE FUNCTION refresh_price_history()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY pool_price_history_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**My recommendation:** Start with **VIEW**, upgrade to **MATERIALIZED VIEW** only if slow.

---

#### 5. **`user_portfolio_summary`** (View)

**Aggregate view for user dashboard:**
```sql
CREATE VIEW user_portfolio_summary AS
SELECT
  user_id,
  COUNT(DISTINCT pool_address) as pools_traded,
  SUM(token_balance) as total_tokens_held,
  SUM(total_usdc_spent - total_usdc_received) as net_invested,
  SUM(CASE WHEN token_balance > 0 THEN 1 ELSE 0 END) as active_positions
FROM user_pool_positions
GROUP BY user_id;
```

---

## Data Access Patterns (Optimized for Analytics)

### **Pattern 1: User's Trade History**
```sql
-- Fast: Single index scan
SELECT * FROM trades
WHERE user_id = $1
ORDER BY recorded_at DESC
LIMIT 50;

-- Performance: O(log n) with index
```

### **Pattern 2: Pool's Price Chart**
```sql
-- Option A: Direct from trades (simple, may be slow)
SELECT
  recorded_at,
  reserve_after / (k_quadratic * POWER(token_supply_after, 2)) as price
FROM trades
WHERE pool_address = $1
ORDER BY recorded_at;

-- Option B: From materialized view (faster)
SELECT recorded_at, price
FROM pool_price_history_mv
WHERE pool_address = $1
ORDER BY recorded_at;

-- Performance: O(log n + k) where k = rows returned
```

### **Pattern 3: User's Pool Position**
```sql
-- Instant: Single primary key lookup
SELECT * FROM user_pool_positions
WHERE user_id = $1 AND pool_address = $2;

-- Performance: O(1) with unique index
```

### **Pattern 4: Pool's Top Holders**
```sql
-- Fast: Single index scan
SELECT user_id, token_balance
FROM user_pool_positions
WHERE pool_address = $1
ORDER BY token_balance DESC
LIMIT 10;

-- Performance: O(log n + 10)
```

### **Pattern 5: Belief Relevance History**
```sql
-- Fast: Single index scan
SELECT epoch, delta_relevance, certainty
FROM belief_relevance_history
WHERE belief_id = $1
ORDER BY epoch;

-- Performance: O(log n + k)
```

---

## Scaling Considerations

### **Partitioning Strategy (Future)**

When `trades` table exceeds 10M rows (~10 years), partition by time:

```sql
CREATE TABLE trades (
  -- same columns
  recorded_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (recorded_at);

CREATE TABLE trades_2025 PARTITION OF trades
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE trades_2026 PARTITION OF trades
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Old partitions can be archived to cold storage
```

**Benefits:**
- Query only relevant time ranges
- Archive old data cheaply
- Maintain indexes per partition (faster)

---

### **Data Retention Policy**

```sql
-- Trades: Keep forever (immutable facts)
-- Belief history: Keep forever (protocol history)
-- User positions: Keep while user active, archive on deletion
-- Price history (if separate): Archive >1 year to cold storage
```

---

## Storage Estimation (5-Year Projection)

**Assumptions:**
- 10,000 users
- 100,000 posts/pools total
- 1,000 trades/day average
- 100 epochs/year

**Table sizes:**

| Table | Rows (5yr) | Size/Row | Total Size |
|-------|------------|----------|------------|
| trades | 1.8M | 500 bytes | **900 MB** |
| belief_relevance_history | 5M | 100 bytes | **500 MB** |
| user_pool_positions | 50K | 200 bytes | **10 MB** |
| **TOTAL** | | | **~1.5 GB** |

**With indexes:** ~3-4 GB total (very manageable)

---

## Final Recommendation: Simplified 3-Table Schema

### **Keep:**
1. ✅ **`trades`** (fact table)
2. ✅ **`belief_relevance_history`** (time-series)
3. ✅ **`user_pool_positions`** (aggregate)

### **Remove:**
4. ❌ **`pool_price_history`** → Replace with VIEW or MATERIALIZED VIEW derived from `trades`

### **Rationale:**
- **Simpler:** 3 tables instead of 4
- **No redundancy:** Price is always derivable from trades
- **Flexibility:** Can switch to materialized view if needed
- **Standard practice:** Fact table + dimension tables + aggregates

---

## Migration Strategy

### **Phase 1: Core Tables (Now)**
```sql
CREATE TABLE trades (...);
CREATE TABLE belief_relevance_history (...);
CREATE TABLE user_pool_positions (...);
CREATE TRIGGER update_positions_after_trade;
```

### **Phase 2: Derived View (Now)**
```sql
CREATE VIEW pool_price_snapshots AS ...;
```

### **Phase 3: Optimize (If Needed)**
```sql
-- Only if VIEW is too slow
CREATE MATERIALIZED VIEW pool_price_history_mv AS ...;
```

### **Phase 4: Partition (Year 3+)**
```sql
-- Only when trades > 10M rows
ALTER TABLE trades ... PARTITION BY RANGE;
```

---

## Benchmarking Queries (Test This!)

```sql
-- Test: User trade history (should be <10ms)
EXPLAIN ANALYZE
SELECT * FROM trades WHERE user_id = 'xxx' ORDER BY recorded_at DESC LIMIT 50;

-- Test: Pool price chart (should be <50ms for VIEW, <10ms for MATERIALIZED)
EXPLAIN ANALYZE
SELECT recorded_at,
       reserve_after / (k_quadratic * POWER(token_supply_after, 2)) as price
FROM trades
WHERE pool_address = 'xxx'
ORDER BY recorded_at;

-- Test: User position lookup (should be <5ms)
EXPLAIN ANALYZE
SELECT * FROM user_pool_positions
WHERE user_id = 'xxx' AND pool_address = 'xxx';
```

**Acceptable performance:**
- Single-user queries: <50ms
- Aggregations: <200ms
- Complex analytics: <1s

If slower, add indexes or materialize.

---

## Summary

### **Anti-Patterns to Avoid:**
- ❌ Separate tables per pool/user
- ❌ Storing derivable data without justification
- ❌ Over-normalization (e.g., separate table for each attribute)
- ❌ Under-indexing (forgetting access patterns)

### **Best Practices Applied:**
- ✅ Single source of truth (trades table)
- ✅ Denormalize when justified (k_quadratic in trades)
- ✅ Aggregate frequently-queried data (user_pool_positions)
- ✅ Time-series data in separate table (belief_relevance_history)
- ✅ Index by access pattern (user_id, pool_address, recorded_at)
- ✅ Use views for derivable data (pool_price_snapshots)

### **Result:**
- **3 core tables** (minimal schema)
- **Fast queries** (proper indexes)
- **Low storage** (no redundancy)
- **Easy analytics** (SQL-friendly structure)
- **Scalable** (partitioning-ready)

---

**Your Question:** "Does that mean we need so many new tables?"

**Answer:** We only need **3 tables**, not 4. The price history is derivable from trades.

**Your Question:** "Will those tables store data for all pools and all users?"

**Answer:** YES, and that's the correct approach. Single tables with proper indexes scale better than fragmented tables.

---

**Status:** Ready for review and implementation
**Recommendation:** Implement simplified 3-table schema with VIEW for price history

