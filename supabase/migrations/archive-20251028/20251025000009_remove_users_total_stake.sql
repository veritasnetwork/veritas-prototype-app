-- Remove redundant users.total_stake column
-- The source of truth is agents.total_stake (bigint, micro-USDC format)
-- This column was a denormalized cache that caused sync issues

-- First, drop all versions of add_agent_stake function
DROP FUNCTION IF EXISTS add_agent_stake(uuid, numeric);
DROP FUNCTION IF EXISTS add_agent_stake(uuid, bigint);

-- Recreate add_agent_stake function to only update agents table
CREATE FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint)
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
    -- Update agent's total stake (in micro-USDC)
    UPDATE agents
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE id = p_agent_id;
END;
$$;

COMMENT ON FUNCTION add_agent_stake(uuid, bigint) IS 'Add stake to agent total_stake. Amount is in micro-USDC (bigint).';

-- Drop the redundant column from users table
ALTER TABLE users DROP COLUMN IF EXISTS total_stake;

COMMENT ON TABLE users IS 'App-layer users. For stake information, join to agents table via agent_id.';
