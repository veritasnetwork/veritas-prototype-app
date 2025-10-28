-- Fix belief_lock values that were stored in display USDC instead of micro-USDC
-- This corrects data from before the belief_lock calculation bug was fixed

-- Update existing belief_lock values by multiplying by 1,000,000
-- Only update rows where the lock is suspiciously small (< 1000, indicating it's in display USDC)
UPDATE user_pool_balances
SET belief_lock = belief_lock * 1000000
WHERE belief_lock > 0 AND belief_lock < 1000
  AND token_balance > 0;

-- Log how many rows were fixed
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % belief_lock values from display USDC to micro-USDC', v_count;
END $$;