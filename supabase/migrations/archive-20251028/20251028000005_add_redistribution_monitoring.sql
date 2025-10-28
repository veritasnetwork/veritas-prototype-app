-- Add monitoring views and helper functions for stake redistribution
-- These tools enable verification that redistributions are correct and zero-sum

-- View: Summary of each redistribution event
CREATE OR REPLACE VIEW redistribution_summary AS
SELECT
  sre.belief_id,
  sre.epoch,
  COUNT(DISTINCT sre.agent_id) as participant_count,
  SUM(CASE WHEN sre.stake_delta > 0 THEN 1 ELSE 0 END) as winner_count,
  SUM(CASE WHEN sre.stake_delta < 0 THEN 1 ELSE 0 END) as loser_count,
  SUM(CASE WHEN sre.stake_delta > 0 THEN sre.stake_delta ELSE 0 END) as total_rewards_micro,
  SUM(CASE WHEN sre.stake_delta < 0 THEN ABS(sre.stake_delta) ELSE 0 END) as total_slashes_micro,
  SUM(sre.stake_delta) as net_delta_micro,
  ABS(SUM(sre.stake_delta)) <= 1 as is_zero_sum,
  MIN(sre.processed_at) as processed_at
FROM stake_redistribution_events sre
GROUP BY sre.belief_id, sre.epoch
ORDER BY processed_at DESC;

COMMENT ON VIEW redistribution_summary IS
'Summary of each redistribution event showing winners/losers and zero-sum validation. Use this to verify that all redistributions maintain the zero-sum property.';

-- Function: Get redistribution history for a specific agent
CREATE OR REPLACE FUNCTION get_agent_redistribution_history(p_agent_id uuid)
RETURNS TABLE(
  belief_id uuid,
  epoch integer,
  information_score numeric,
  stake_delta bigint,
  stake_delta_usdc numeric,
  processed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    belief_id,
    epoch,
    information_score,
    stake_delta,
    stake_delta / 1000000.0 as stake_delta_usdc,
    processed_at
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
  ORDER BY processed_at DESC;
$$;

COMMENT ON FUNCTION get_agent_redistribution_history IS
'Get complete redistribution history for an agent, showing all rewards and penalties in chronological order';

-- Function: Check if redistribution is zero-sum
CREATE OR REPLACE FUNCTION check_redistribution_zero_sum(
  p_belief_id uuid,
  p_epoch integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_delta bigint;
  v_participant_count integer;
  v_total_rewards bigint;
  v_total_slashes bigint;
BEGIN
  SELECT
    SUM(stake_delta),
    COUNT(DISTINCT agent_id),
    SUM(CASE WHEN stake_delta > 0 THEN stake_delta ELSE 0 END),
    SUM(CASE WHEN stake_delta < 0 THEN ABS(stake_delta) ELSE 0 END)
  INTO v_total_delta, v_participant_count, v_total_rewards, v_total_slashes
  FROM stake_redistribution_events
  WHERE belief_id = p_belief_id
    AND epoch = p_epoch;

  RETURN jsonb_build_object(
    'belief_id', p_belief_id,
    'epoch', p_epoch,
    'participant_count', COALESCE(v_participant_count, 0),
    'total_delta_micro', COALESCE(v_total_delta, 0),
    'total_rewards_micro', COALESCE(v_total_rewards, 0),
    'total_slashes_micro', COALESCE(v_total_slashes, 0),
    'is_zero_sum', ABS(COALESCE(v_total_delta, 0)) <= 1,
    'delta_usdc', COALESCE(v_total_delta, 0) / 1000000.0
  );
END;
$$;

COMMENT ON FUNCTION check_redistribution_zero_sum IS
'Verify that a specific redistribution event maintains the zero-sum property. Returns detailed breakdown of rewards, slashes, and net delta.';

-- Grant permissions
GRANT SELECT ON redistribution_summary TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_redistribution_history TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_redistribution_zero_sum TO anon, authenticated, service_role;
