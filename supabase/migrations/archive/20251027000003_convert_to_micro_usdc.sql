-- Convert agents.total_stake from DECIMAL(10,2) USDC to BIGINT micro-USDC
ALTER TABLE agents
ALTER COLUMN total_stake TYPE BIGINT
USING (total_stake * 1000000)::BIGINT;

-- Convert user_pool_balances columns from NUMERIC USDC to BIGINT micro-USDC
-- Note: belief_lock and last_buy_amount should already be in micro-USDC if populated correctly
-- but we'll ensure consistency by checking if they're < 1000 (likely in USDC) vs >= 1000 (likely already in micro-USDC)
ALTER TABLE user_pool_balances
ALTER COLUMN belief_lock TYPE BIGINT
USING (CASE
  WHEN belief_lock IS NULL THEN 0
  WHEN belief_lock < 1000 THEN (belief_lock * 1000000)::BIGINT
  ELSE belief_lock::BIGINT
END);

ALTER TABLE user_pool_balances
ALTER COLUMN last_buy_amount TYPE BIGINT
USING (CASE
  WHEN last_buy_amount IS NULL THEN 0
  WHEN last_buy_amount < 1000 THEN (last_buy_amount * 1000000)::BIGINT
  ELSE last_buy_amount::BIGINT
END);

-- Add constraints
ALTER TABLE agents ADD CONSTRAINT agents_total_stake_non_negative CHECK (total_stake >= 0);
ALTER TABLE user_pool_balances ADD CONSTRAINT user_pool_balances_belief_lock_non_negative CHECK (belief_lock >= 0);
