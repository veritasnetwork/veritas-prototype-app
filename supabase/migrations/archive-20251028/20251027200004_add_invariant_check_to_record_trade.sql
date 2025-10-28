-- Add stake state logging for debugging
-- This creates a function to log stake state after trades
-- Used to detect when underwater positions are created

CREATE OR REPLACE FUNCTION log_stake_state_after_trade(
  p_agent_id uuid,
  p_tx_signature text,
  p_skim_credited boolean
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

  -- Get sum of all locks
  SELECT COALESCE(SUM(upb.belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances upb
  INNER JOIN users u ON u.id = upb.user_id
  WHERE u.agent_id = p_agent_id
    AND upb.token_balance > 0;

  -- Log the state
  RAISE NOTICE '🔍 STAKE STATE AFTER TRADE %: stake=% locks=% deficit=% skim_credited=%',
    p_tx_signature, v_total_stake, v_total_locks, (v_total_locks - v_total_stake), p_skim_credited;

  -- Check invariant and warn if violated
  IF v_total_stake < v_total_locks THEN
    v_deficit := v_total_locks - v_total_stake;
    RAISE WARNING '⚠️  STAKE INVARIANT VIOLATION: total_stake (%) < total_locks (%). Deficit: % micro-USDC. TX: %',
      v_total_stake, v_total_locks, v_deficit, p_tx_signature;
  END IF;
END;
$$;

COMMENT ON FUNCTION log_stake_state_after_trade IS
'Logs stake state after a trade and warns if invariant is violated.
Used for debugging skim calculation issues.
Does not block trades - only logs warnings for monitoring.';