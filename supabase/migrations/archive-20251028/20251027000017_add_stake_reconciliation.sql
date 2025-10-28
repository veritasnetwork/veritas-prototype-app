-- Reconciliation function to verify total_stake matches event-sourced accounting
-- This helps detect and debug any discrepancies in stake tracking

CREATE OR REPLACE FUNCTION reconcile_agent_stake(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recorded_stake bigint;
  v_calculated_stake bigint;
  v_deposits bigint;
  v_withdrawals bigint;
  v_rewards bigint;
  v_penalties bigint;
  v_discrepancy bigint;
BEGIN
  -- Get current recorded stake
  SELECT COALESCE(total_stake, 0)
  INTO v_recorded_stake
  FROM agents
  WHERE id = p_agent_id;

  -- Calculate stake from custodian deposits (trade skims)
  -- stored in display USDC, convert to micro-USDC
  SELECT COALESCE(SUM((amount_usdc * 1000000)::bigint), 0)
  INTO v_deposits
  FROM custodian_deposits
  WHERE agent_id = p_agent_id
    AND agent_credited = true
    AND deposit_type = 'trade_skim';

  -- Calculate stake from withdrawals
  -- stored in display USDC, convert to micro-USDC
  SELECT COALESCE(SUM((amount_usdc * 1000000)::bigint), 0)
  INTO v_withdrawals
  FROM custodian_withdrawals
  WHERE agent_id = p_agent_id
    AND status = 'completed';

  -- Calculate rewards from stake redistribution
  SELECT COALESCE(SUM(stake_delta), 0)
  INTO v_rewards
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
    AND stake_delta > 0;

  -- Calculate penalties from stake redistribution
  SELECT COALESCE(SUM(ABS(stake_delta)), 0)
  INTO v_penalties
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
    AND stake_delta < 0;

  -- Calculate what stake SHOULD be
  v_calculated_stake := v_deposits - v_withdrawals + v_rewards - v_penalties;

  -- Calculate discrepancy
  v_discrepancy := v_recorded_stake - v_calculated_stake;

  RETURN jsonb_build_object(
    'agent_id', p_agent_id,
    'recorded_stake', v_recorded_stake,
    'calculated_stake', v_calculated_stake,
    'discrepancy', v_discrepancy,
    'is_correct', (v_discrepancy = 0),
    'breakdown', jsonb_build_object(
      'deposits', v_deposits,
      'withdrawals', v_withdrawals,
      'rewards', v_rewards,
      'penalties', v_penalties
    )
  );
END;
$$;

COMMENT ON FUNCTION reconcile_agent_stake IS 'Verifies total_stake by comparing recorded value against sum of all events (deposits, withdrawals, rewards, penalties). Returns breakdown and discrepancy.';

-- Function to reconcile ALL agents at once
CREATE OR REPLACE FUNCTION reconcile_all_agents()
RETURNS TABLE(
  agent_id uuid,
  recorded_stake bigint,
  calculated_stake bigint,
  discrepancy bigint,
  is_correct boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    COALESCE(a.total_stake, 0),
    (
      -- Deposits
      COALESCE((
        SELECT SUM((cd.amount_usdc * 1000000)::bigint)
        FROM custodian_deposits cd
        WHERE cd.agent_id = a.id
          AND cd.agent_credited = true
          AND cd.deposit_type = 'trade_skim'
      ), 0)
      -- Withdrawals (subtract)
      - COALESCE((
        SELECT SUM((cw.amount_usdc * 1000000)::bigint)
        FROM custodian_withdrawals cw
        WHERE cw.agent_id = a.id
          AND cw.status = 'completed'
      ), 0)
      -- Rewards (add)
      + COALESCE((
        SELECT SUM(sre.stake_delta)
        FROM stake_redistribution_events sre
        WHERE sre.agent_id = a.id
          AND sre.stake_delta > 0
      ), 0)
      -- Penalties (subtract)
      - COALESCE((
        SELECT SUM(ABS(sre.stake_delta))
        FROM stake_redistribution_events sre
        WHERE sre.agent_id = a.id
          AND sre.stake_delta < 0
      ), 0)
    ) as calculated,
    (
      COALESCE(a.total_stake, 0) -
      (
        COALESCE((SELECT SUM((cd.amount_usdc * 1000000)::bigint) FROM custodian_deposits cd WHERE cd.agent_id = a.id AND cd.agent_credited = true AND cd.deposit_type = 'trade_skim'), 0) -
        COALESCE((SELECT SUM((cw.amount_usdc * 1000000)::bigint) FROM custodian_withdrawals cw WHERE cw.agent_id = a.id AND cw.status = 'completed'), 0) +
        COALESCE((SELECT SUM(sre.stake_delta) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta > 0), 0) -
        COALESCE((SELECT SUM(ABS(sre.stake_delta)) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta < 0), 0)
      )
    ) as diff,
    (
      COALESCE(a.total_stake, 0) =
      (
        COALESCE((SELECT SUM((cd.amount_usdc * 1000000)::bigint) FROM custodian_deposits cd WHERE cd.agent_id = a.id AND cd.agent_credited = true AND cd.deposit_type = 'trade_skim'), 0) -
        COALESCE((SELECT SUM((cw.amount_usdc * 1000000)::bigint) FROM custodian_withdrawals cw WHERE cw.agent_id = a.id AND cw.status = 'completed'), 0) +
        COALESCE((SELECT SUM(sre.stake_delta) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta > 0), 0) -
        COALESCE((SELECT SUM(ABS(sre.stake_delta)) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta < 0), 0)
      )
    ) as correct
  FROM agents a;
END;
$$;

COMMENT ON FUNCTION reconcile_all_agents IS 'Checks all agents for stake discrepancies. Returns table showing recorded vs calculated stake for each agent.';
