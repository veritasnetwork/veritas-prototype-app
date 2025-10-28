-- Fix corrupted belief_lock values from double-conversion bug
-- Belief lock should be 2% of total_usdc_spent (total_usdc_spent / 50)

-- Recalculate belief_lock for all positions
UPDATE user_pool_balances
SET belief_lock = FLOOR(total_usdc_spent / 50)::BIGINT
WHERE token_balance > 0;

-- For positions with zero balance, set lock to zero
UPDATE user_pool_balances
SET belief_lock = 0
WHERE token_balance = 0;

-- Reset total_stake in agents table to zero (will be skimmed again on next trades)
-- This is safe because we're fixing the lock calculations
UPDATE agents
SET total_stake = 0;
