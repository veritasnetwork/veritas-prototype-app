-- Reconcile historical user_pool_balances from trades table
-- This fixes all the broken cumulative totals

-- Create a function to recalculate balances
CREATE OR REPLACE FUNCTION reconcile_user_pool_balances()
RETURNS TABLE (
  updated_count integer,
  message text
) AS $$
DECLARE
  v_count integer := 0;
  v_balance record;
  v_total_bought numeric;
  v_total_sold numeric;
  v_total_spent numeric;
  v_total_received numeric;
  v_net_balance numeric;
BEGIN
  -- Loop through each user pool balance
  FOR v_balance IN
    SELECT * FROM user_pool_balances
    ORDER BY user_id, pool_address, token_type
  LOOP
    -- Calculate totals from trades history
    SELECT
      COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN token_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN trade_type = 'sell' THEN token_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN usdc_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN trade_type = 'sell' THEN usdc_amount ELSE 0 END), 0)
    INTO v_total_bought, v_total_sold, v_total_spent, v_total_received
    FROM trades
    WHERE user_id = v_balance.user_id
      AND pool_address = v_balance.pool_address
      AND side = v_balance.token_type;

    -- Calculate net balance (bought - sold)
    v_net_balance := v_total_bought - v_total_sold;

    -- Only update if there's a discrepancy
    IF v_balance.total_bought != v_total_bought OR
       v_balance.total_sold != v_total_sold OR
       v_balance.total_usdc_spent != v_total_spent OR
       v_balance.total_usdc_received != v_total_received OR
       ABS(v_balance.token_balance - v_net_balance) > 0.000001
    THEN
      UPDATE user_pool_balances
      SET
        token_balance = v_net_balance,
        total_bought = v_total_bought,
        total_sold = v_total_sold,
        total_usdc_spent = v_total_spent,
        total_usdc_received = v_total_received,
        updated_at = NOW()
      WHERE id = v_balance.id;

      v_count := v_count + 1;

      RAISE NOTICE 'Fixed balance for user %, pool %, type %: bought % -> %, spent % -> %',
        v_balance.user_id,
        LEFT(v_balance.pool_address, 8),
        v_balance.token_type,
        v_balance.total_bought,
        v_total_bought,
        v_balance.total_usdc_spent / 1000000,
        v_total_spent / 1000000;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_count, 'Reconciliation completed. Fixed ' || v_count || ' balance records.';
END;
$$ LANGUAGE plpgsql;

-- Run the reconciliation
SELECT * FROM reconcile_user_pool_balances();

-- Drop the function after use
DROP FUNCTION reconcile_user_pool_balances()