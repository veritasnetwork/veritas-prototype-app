-- Function to add stake to an agent
CREATE OR REPLACE FUNCTION add_agent_stake(
    p_agent_id UUID,
    p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
    -- Update agent's total stake
    UPDATE agents
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE id = p_agent_id;

    -- Also update the user's total_stake field
    UPDATE users
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    -- Log this stake change (if we have a stake history table in future)
    -- INSERT INTO user_stake_history (user_id, change_amount, reason, created_at)
    -- SELECT id, p_amount, 'invite_bonus', NOW()
    -- FROM users WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;