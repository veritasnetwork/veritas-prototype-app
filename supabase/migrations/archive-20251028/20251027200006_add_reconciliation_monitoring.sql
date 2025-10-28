-- Add balance sheet reconciliation monitoring functions
-- These detect data integrity issues across the entire system

-- 1. Check all agents for stake invariant violations
CREATE OR REPLACE FUNCTION check_all_agents_solvency()
RETURNS TABLE(
  agent_id uuid,
  stake_usdc numeric,
  locks_usdc numeric,
  withdrawable_usdc numeric,
  status text,
  deficit_usdc numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as agent_id,
    a.total_stake / 1000000.0 as stake_usdc,
    COALESCE(SUM(upb.belief_lock), 0) / 1000000.0 as locks_usdc,
    (a.total_stake - COALESCE(SUM(upb.belief_lock), 0)) / 1000000.0 as withdrawable_usdc,
    CASE
      WHEN a.total_stake >= COALESCE(SUM(upb.belief_lock), 0) THEN '✅ SOLVENT'
      ELSE '❌ UNDERWATER'
    END as status,
    CASE
      WHEN a.total_stake < COALESCE(SUM(upb.belief_lock), 0)
      THEN (COALESCE(SUM(upb.belief_lock), 0) - a.total_stake) / 1000000.0
      ELSE 0
    END as deficit_usdc
  FROM agents a
  LEFT JOIN users u ON u.agent_id = a.id
  LEFT JOIN user_pool_balances upb ON upb.user_id = u.id AND upb.token_balance > 0
  GROUP BY a.id, a.total_stake
  ORDER BY deficit_usdc DESC;
END;
$$;

COMMENT ON FUNCTION check_all_agents_solvency IS
'Returns solvency status for all agents.
Use this to detect underwater positions across the system.
Returns agents ordered by deficit (worst first).';

-- 2. Validate belief_lock values are in correct range
CREATE OR REPLACE FUNCTION check_belief_lock_units()
RETURNS TABLE(
  pool_address text,
  token_type text,
  belief_lock bigint,
  lock_usdc numeric,
  status text,
  issue text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    upb.pool_address,
    upb.token_type,
    upb.belief_lock,
    upb.belief_lock / 1000000.0 as lock_usdc,
    CASE
      WHEN upb.belief_lock < 1000 THEN '❌ FAIL'
      WHEN upb.belief_lock > 1000000000 THEN '❌ FAIL'
      ELSE '✅ OK'
    END as status,
    CASE
      WHEN upb.belief_lock < 1000 THEN 'Too small - likely stored as display USDC instead of micro-USDC'
      WHEN upb.belief_lock > 1000000000 THEN 'Too large - exceeds reasonable trade size ($1000)'
      ELSE NULL
    END as issue
  FROM user_pool_balances upb
  WHERE upb.token_balance > 0
  ORDER BY
    CASE
      WHEN upb.belief_lock < 1000 THEN 1
      WHEN upb.belief_lock > 1000000000 THEN 2
      ELSE 3
    END,
    upb.belief_lock;
END;
$$;

COMMENT ON FUNCTION check_belief_lock_units IS
'Validates that all belief_lock values are in the correct unit range.
Detects units mismatch bugs (display USDC vs micro-USDC).
Returns problematic locks first.';

-- 3. Balance sheet reconciliation
CREATE OR REPLACE FUNCTION reconcile_balance_sheet()
RETURNS TABLE(
  metric text,
  value_usdc numeric,
  status text,
  note text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_deposits numeric;
  v_total_withdrawals numeric;
  v_net_custodian numeric;
  v_total_agent_stakes numeric;
  v_total_locks numeric;
  v_difference numeric;
BEGIN
  -- Sum all deposits
  SELECT COALESCE(SUM(amount_usdc), 0) INTO v_total_deposits
  FROM custodian_deposits
  WHERE agent_credited = true;

  -- Sum all confirmed withdrawals
  SELECT COALESCE(SUM(amount_usdc), 0) INTO v_total_withdrawals
  FROM custodian_withdrawals
  WHERE confirmed = true OR status = 'completed';

  -- Net custodian balance
  v_net_custodian := v_total_deposits - v_total_withdrawals;

  -- Sum all agent stakes
  SELECT COALESCE(SUM(total_stake), 0) / 1000000.0 INTO v_total_agent_stakes
  FROM agents;

  -- Sum all locks
  SELECT COALESCE(SUM(belief_lock), 0) / 1000000.0 INTO v_total_locks
  FROM user_pool_balances
  WHERE token_balance > 0;

  -- Calculate difference
  v_difference := v_net_custodian - v_total_agent_stakes;

  RETURN QUERY VALUES
    ('Total Deposits', v_total_deposits, '📥', 'All credited skim + manual deposits'),
    ('Total Withdrawals', v_total_withdrawals, '📤', 'All confirmed withdrawals'),
    ('Net Custodian Balance', v_net_custodian, '🏦', 'Deposits - Withdrawals'),
    ('Total Agent Stakes', v_total_agent_stakes, '👥', 'Sum of agents.total_stake'),
    ('Total Locks', v_total_locks, '🔒', 'Sum of belief_locks for open positions'),
    ('Difference (Custodian - Stakes)', v_difference,
      CASE
        WHEN ABS(v_difference) < 0.01 THEN '✅'
        WHEN ABS(v_difference) < 1.00 THEN '⚠️'
        ELSE '❌'
      END,
      CASE
        WHEN ABS(v_difference) < 0.01 THEN 'Balanced (within rounding)'
        WHEN ABS(v_difference) < 1.00 THEN 'Minor discrepancy (< $1)'
        WHEN v_difference > 0 THEN 'Custodian has more than stakes (investigate deposits)'
        ELSE 'Stakes exceed custodian (critical error!)'
      END
    );
END;
$$;

COMMENT ON FUNCTION reconcile_balance_sheet IS
'Performs full balance sheet reconciliation.
Ensures: deposits - withdrawals = sum(agent stakes).
Detects accounting errors, missing deposits, or double-credits.';

-- 4. Create a view for easy monitoring
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT
  (SELECT COUNT(*) FROM agents) as total_agents,
  (SELECT COUNT(*) FROM check_all_agents_solvency() WHERE status = '❌ UNDERWATER') as agents_underwater,
  (SELECT SUM(deficit_usdc) FROM check_all_agents_solvency()) as total_deficit_usdc,
  (SELECT COUNT(*) FROM check_belief_lock_units() WHERE status = '❌ FAIL') as bad_locks_count,
  (SELECT value_usdc FROM reconcile_balance_sheet() WHERE metric = 'Net Custodian Balance') as custodian_balance_usdc,
  (SELECT value_usdc FROM reconcile_balance_sheet() WHERE metric = 'Total Agent Stakes') as total_stakes_usdc,
  (SELECT value_usdc FROM reconcile_balance_sheet() WHERE metric = 'Total Locks') as total_locks_usdc,
  (SELECT value_usdc FROM reconcile_balance_sheet() WHERE metric = 'Difference (Custodian - Stakes)') as balance_difference_usdc,
  (SELECT status FROM reconcile_balance_sheet() WHERE metric = 'Difference (Custodian - Stakes)') as balance_status;

COMMENT ON VIEW system_health_dashboard IS
'Quick overview of system health.
Check this regularly to detect data integrity issues early.
Red flags: agents_underwater > 0, bad_locks_count > 0, balance_status = ❌';