CREATE OR REPLACE FUNCTION update_stake_atomic(p_agent_id UUID, p_delta_micro BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE agents SET total_stake = GREATEST(0, total_stake + p_delta_micro) WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql;
