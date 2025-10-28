-- Fix corrupted trade amounts from event processor bug
-- Trades with usdc_amount > 1 billion are clearly wrong (should be micro-USDC, max realistic is ~1M USDC = 1 trillion micro)

-- Find and fix trades with absurdly large USDC amounts (likely 1e12 instead of 1e6)
-- These are trades where the amount was multiplied by 1,000,000 twice
UPDATE trades
SET usdc_amount = usdc_amount / 1000000
WHERE usdc_amount::BIGINT > 1000000000000; -- > 1 million USDC in micro (clearly wrong)

-- Now recalculate user_pool_balances cumulative totals from corrected trades
-- This will properly sum up total_usdc_spent and total_usdc_received

-- Temporarily drop the unique constraint to allow rebuilding
ALTER TABLE user_pool_balances DROP CONSTRAINT IF EXISTS user_pool_balances_pkey;
ALTER TABLE user_pool_balances DROP CONSTRAINT IF EXISTS user_pool_balances_user_id_pool_address_token_type_key;

-- Delete all existing records (we'll rebuild from trades)
TRUNCATE user_pool_balances;

-- Rebuild from trades table with correct cumulative totals
INSERT INTO user_pool_balances (
  user_id,
  pool_address,
  post_id,
  token_type,
  token_balance,
  belief_lock,
  total_bought,
  total_sold,
  total_usdc_spent,
  total_usdc_received,
  last_trade_at,
  updated_at
)
SELECT
  t.user_id,
  t.pool_address,
  t.post_id,
  t.side,
  -- Token balance = total bought - total sold
  COALESCE(SUM(CASE WHEN t.trade_type = 'buy' THEN t.token_amount::NUMERIC ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN t.trade_type = 'sell' THEN t.token_amount::NUMERIC ELSE 0 END), 0) as token_balance,
  -- Belief lock = 2% of total USDC spent (will be recalculated)
  0 as belief_lock,
  -- Total bought tokens
  COALESCE(SUM(CASE WHEN t.trade_type = 'buy' THEN t.token_amount::NUMERIC ELSE 0 END), 0) as total_bought,
  -- Total sold tokens
  COALESCE(SUM(CASE WHEN t.trade_type = 'sell' THEN t.token_amount::NUMERIC ELSE 0 END), 0) as total_sold,
  -- Total USDC spent (buys)
  COALESCE(SUM(CASE WHEN t.trade_type = 'buy' THEN t.usdc_amount::BIGINT ELSE 0 END), 0) as total_usdc_spent,
  -- Total USDC received (sells)
  COALESCE(SUM(CASE WHEN t.trade_type = 'sell' THEN t.usdc_amount::BIGINT ELSE 0 END), 0) as total_usdc_received,
  MAX(t.created_at) as last_trade_at,
  NOW() as updated_at
FROM trades t
GROUP BY t.user_id, t.pool_address, t.post_id, t.side;

-- Restore unique constraint
ALTER TABLE user_pool_balances ADD PRIMARY KEY (user_id, pool_address, token_type);

-- Now recalculate belief_lock properly (2% of total_usdc_spent)
UPDATE user_pool_balances
SET belief_lock = FLOOR(total_usdc_spent / 50)::BIGINT
WHERE token_balance > 0;

-- Reset total_stake in agents to zero (will be skimmed on next trades)
UPDATE agents
SET total_stake = 0;
