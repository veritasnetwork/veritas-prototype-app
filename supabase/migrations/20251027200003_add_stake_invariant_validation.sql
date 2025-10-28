-- Add stake invariant validation to record_trade_atomic
-- This enforces that total_stake >= total_locks BEFORE completing a trade
-- Prevents underwater positions from being created during normal trading

-- We'll add this check right after the skim deposit section
-- This is a CRITICAL SAFETY CHECK that should never be bypassed

CREATE OR REPLACE FUNCTION validate_stake_invariant(
  p_agent_id uuid,
  p_trade_context text  -- For error messages
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_stake bigint;
  v_total_locks bigint;
  v_deficit bigint;
BEGIN
  -- Get current stake
  SELECT total_stake INTO v_total_stake
  FROM agents
  WHERE id = p_agent_id;

  -- Get sum of all locks across ALL pools for this agent's user
  SELECT COALESCE(SUM(upb.belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances upb
  INNER JOIN users u ON u.id = upb.user_id
  WHERE u.agent_id = p_agent_id
    AND upb.token_balance > 0;

  -- Check invariant
  IF v_total_stake < v_total_locks THEN
    v_deficit := v_total_locks - v_total_stake;
    RAISE EXCEPTION 'INVARIANT VIOLATION: total_stake (%) < total_locks (%). Deficit: % micro-USDC. Context: %',
      v_total_stake, v_total_locks, v_deficit, p_trade_context;
  END IF;

  RAISE NOTICE 'Stake invariant OK: stake=% >= locks=% (context: %)', v_total_stake, v_total_locks, p_trade_context;
END;
$$;

COMMENT ON FUNCTION validate_stake_invariant IS
'Validates that total_stake >= sum(all belief_locks).
Throws exception if invariant is violated.
This should be called at the END of record_trade_atomic to catch any skim calculation bugs.';