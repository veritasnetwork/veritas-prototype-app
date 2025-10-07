# User Pool Positions - Current State vs History

## The Confusion

You're right to question this! The name `user_pool_positions` **sounds like a history table**, but it's actually a **current state snapshot**.

---

## What It Actually Is

### **Current Design: Single Row Per User-Pool Pair**

```sql
CREATE TABLE user_pool_positions (
  user_id UUID,
  pool_address TEXT,
  token_balance NUMERIC,          -- Current balance RIGHT NOW
  total_bought NUMERIC,            -- Lifetime cumulative
  total_sold NUMERIC,              -- Lifetime cumulative
  total_usdc_spent NUMERIC,        -- Lifetime cumulative
  total_usdc_received NUMERIC,     -- Lifetime cumulative
  first_trade_at TIMESTAMPTZ,      -- When user started trading this pool
  last_trade_at TIMESTAMPTZ,       -- Most recent trade
  UNIQUE(user_id, pool_address)    -- ONE row per user per pool
);
```

### **Example Data:**

| user_id | pool_address | token_balance | total_bought | total_sold | avg_buy_price | last_trade_at |
|---------|--------------|---------------|--------------|------------|---------------|---------------|
| alice   | pool_ABC     | **500**       | 1000         | 500        | $0.01         | 2025-10-07    |
| alice   | pool_XYZ     | **0**         | 200          | 200        | $0.05         | 2025-10-05    |
| bob     | pool_ABC     | **250**       | 250          | 0          | $0.008        | 2025-10-06    |

**Key insight:** This is NOT a history table. It's a **lookup table** that answers:

> "What does this user currently own in this pool?"

---

## How It Works (Step-by-Step)

### **Initial State: User has no position**
```sql
-- user_pool_positions is empty for this user-pool pair
```

### **Trade 1: Alice buys 100 tokens in pool_ABC**
```sql
INSERT INTO trades (...) VALUES ('alice', 'pool_ABC', 'buy', 100, 1.00, ...);

-- Trigger auto-creates position
INSERT INTO user_pool_positions VALUES (
  'alice',
  'pool_ABC',
  token_balance = 100,      -- Current: 100
  total_bought = 100,        -- Lifetime: 100
  total_sold = 0,            -- Lifetime: 0
  total_usdc_spent = 1.00,   -- Lifetime: $1.00
  first_trade_at = NOW(),
  last_trade_at = NOW()
);
```

### **Trade 2: Alice buys another 50 tokens**
```sql
INSERT INTO trades (...) VALUES ('alice', 'pool_ABC', 'buy', 50, 0.60, ...);

-- Trigger UPDATES existing position (not insert!)
UPDATE user_pool_positions
SET
  token_balance = token_balance + 50,      -- 100 → 150
  total_bought = total_bought + 50,         -- 100 → 150
  total_usdc_spent = total_usdc_spent + 0.60, -- $1.00 → $1.60
  last_trade_at = NOW()
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';
```

### **Trade 3: Alice sells 30 tokens**
```sql
INSERT INTO trades (...) VALUES ('alice', 'pool_ABC', 'sell', 30, 0.45, ...);

-- Trigger UPDATES existing position
UPDATE user_pool_positions
SET
  token_balance = token_balance - 30,      -- 150 → 120
  total_sold = total_sold + 30,             -- 0 → 30
  total_usdc_received = total_usdc_received + 0.45, -- $0 → $0.45
  last_trade_at = NOW()
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';
```

**Final state:**
```sql
SELECT * FROM user_pool_positions
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';

-- Returns ONE row:
{
  token_balance: 120,          ← Current holdings
  total_bought: 150,           ← Sum of all buys
  total_sold: 30,              ← Sum of all sells
  total_usdc_spent: $1.60,     ← Cost basis
  total_usdc_received: $0.45,  ← Proceeds from sales
  avg_buy_price: $1.60 / 150 = $0.0107
  realized_pnl: $0.45 - ($0.0107 * 30) = $0.13
}
```

---

## Why This Design?

### **Problem: Aggregating from trades is expensive**

Without `user_pool_positions`, to show "Alice's current balance in pool_ABC":

```sql
-- BAD: Must scan ALL of Alice's trades every time
SELECT
  SUM(CASE WHEN trade_type = 'buy' THEN token_amount
           WHEN trade_type = 'sell' THEN -token_amount END) as balance
FROM trades
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';

-- Performance: O(n) where n = number of trades
-- If Alice has 1000 trades, this scans 1000 rows EVERY page load!
```

### **Solution: Precompute and cache**

```sql
-- GOOD: Single row lookup
SELECT token_balance
FROM user_pool_positions
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';

-- Performance: O(1) with unique index
-- Always scans exactly 1 row, no matter how many trades!
```

---

## Is This History? NO!

### **What history looks like:**

If we wanted to track position changes over time:

```sql
-- HISTORICAL table (NOT what we're doing)
CREATE TABLE user_pool_position_history (
  user_id UUID,
  pool_address TEXT,
  token_balance NUMERIC,
  recorded_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, pool_address, recorded_at)
);

-- Example data (multiple rows per user-pool):
-- Alice's balance in pool_ABC over time:
2025-10-01: 0 tokens
2025-10-02: 100 tokens   (bought 100)
2025-10-03: 150 tokens   (bought 50)
2025-10-04: 120 tokens   (sold 30)
```

**We're NOT doing this!** We only store the **current state**.

---

## So Where Is The History?

### **Answer: In the `trades` table!**

```sql
-- Complete history of Alice's trades in pool_ABC
SELECT
  trade_type,
  token_amount,
  usdc_amount,
  recorded_at,
  -- Calculate running balance
  SUM(CASE WHEN trade_type = 'buy' THEN token_amount
           ELSE -token_amount END) OVER (ORDER BY recorded_at) as balance_after_trade
FROM trades
WHERE user_id = 'alice' AND pool_address = 'pool_ABC'
ORDER BY recorded_at;

-- Result:
buy   100  $1.00   2025-10-02  → balance: 100
buy    50  $0.60   2025-10-03  → balance: 150
sell   30  $0.45   2025-10-04  → balance: 120
```

**This gives you:**
- ✅ Full trade-by-trade history
- ✅ Running balance calculation
- ✅ Can reconstruct position at any point in time

**The `user_pool_positions` table just caches the final result!**

---

## Comparison: Lookup vs History

### **Lookup Table (What We Have)**

```sql
user_pool_positions
├─ alice, pool_ABC → 120 tokens (ONE row)
├─ alice, pool_XYZ → 0 tokens   (ONE row)
└─ bob,   pool_ABC → 250 tokens (ONE row)

Total rows: # of users × # of pools they've traded
~ 50,000 rows for 10,000 users trading 5 pools each
```

**Query pattern:**
```sql
-- What does Alice own in pool_ABC?
SELECT token_balance FROM user_pool_positions
WHERE user_id = 'alice' AND pool_address = 'pool_ABC';
-- Returns: 120 (instant)
```

### **History Table (If We Wanted It)**

```sql
user_pool_position_snapshots
├─ alice, pool_ABC, 2025-10-02 → 100 tokens
├─ alice, pool_ABC, 2025-10-03 → 150 tokens
├─ alice, pool_ABC, 2025-10-04 → 120 tokens
├─ alice, pool_XYZ, 2025-10-01 → 50 tokens
├─ alice, pool_XYZ, 2025-10-05 → 0 tokens
└─ ... (many more rows)

Total rows: # of users × # of pools × # of trades
~ 1,000,000+ rows (much bigger!)
```

**Query pattern:**
```sql
-- What did Alice own in pool_ABC on Oct 3?
SELECT token_balance FROM user_pool_position_snapshots
WHERE user_id = 'alice'
  AND pool_address = 'pool_ABC'
  AND recorded_at <= '2025-10-03'
ORDER BY recorded_at DESC
LIMIT 1;
-- Returns: 150 (slower, more data)
```

---

## Do We Need Position History?

### **Short answer: NO, we already have it in `trades`**

If you need to show "Alice's balance over time" for a chart:

```sql
-- Reconstruct balance at any point from trades
SELECT
  recorded_at,
  SUM(CASE WHEN trade_type = 'buy' THEN token_amount
           ELSE -token_amount END)
    OVER (ORDER BY recorded_at ROWS UNBOUNDED PRECEDING) as running_balance
FROM trades
WHERE user_id = 'alice' AND pool_address = 'pool_ABC'
ORDER BY recorded_at;
```

**Result: Perfect balance history without storing it twice!**

---

## Better Naming?

You're right that the name is confusing. Better alternatives:

### **Option 1: `user_current_holdings`**
```sql
CREATE TABLE user_current_holdings (
  user_id UUID,
  pool_address TEXT,
  token_balance NUMERIC,
  ...
);
```
✅ Clearer: "current" implies snapshot, not history

### **Option 2: `user_pool_balances`**
```sql
CREATE TABLE user_pool_balances (
  user_id UUID,
  pool_address TEXT,
  token_balance NUMERIC,
  ...
);
```
✅ Shorter, implies current balance

### **Option 3: Keep `user_pool_positions` but add comment**
```sql
CREATE TABLE user_pool_positions (
  ...
);

COMMENT ON TABLE user_pool_positions IS
  'Current user holdings per pool (NOT historical). One row per user-pool pair. Auto-updated by trades trigger.';
```

**My recommendation:** Rename to `user_pool_balances` for clarity.

---

## Summary

### **What `user_pool_positions` IS:**
- ✅ Lookup table for current state
- ✅ One row per user-pool pair
- ✅ Updated in real-time via trigger
- ✅ Fast O(1) queries

### **What it is NOT:**
- ❌ Historical snapshots over time
- ❌ Multiple rows per user-pool
- ❌ Time-series data

### **Where history lives:**
- In `trades` table (source of truth)
- Can reconstruct position at any point in time
- Window functions give running balance

### **Why it exists:**
- Aggregating from trades is O(n) on every query
- Pre-computing gives O(1) lookups
- Standard materialized aggregate pattern

---

## Recommendation

1. **Rename table** to `user_pool_balances` (clearer intent)
2. **Keep current design** (one row per user-pool)
3. **Use `trades` table** for historical queries
4. **Add table comment** explaining it's current state, not history

**Updated schema:**
```sql
CREATE TABLE user_pool_balances (
  user_id UUID NOT NULL,
  pool_address TEXT NOT NULL,
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

COMMENT ON TABLE user_pool_balances IS
  'Current user token balances per pool. Auto-updated by trades. For history, query trades table.';
```

**Does this clarify the design?**

