-- Add unique constraint to prevent duplicate redistribution events
-- This is a critical safety measure to prevent double-redistribution bugs
--
-- Problem: If redistribution function is called twice for the same epoch,
-- it would redistribute stakes twice, causing incorrect accounting.
--
-- Solution: Database-level constraint ensures at most one redistribution
-- event per (belief_id, epoch, agent_id) tuple.

ALTER TABLE stake_redistribution_events
ADD CONSTRAINT unique_redistribution_per_agent_epoch
UNIQUE (belief_id, epoch, agent_id);

COMMENT ON CONSTRAINT unique_redistribution_per_agent_epoch
ON stake_redistribution_events IS
'Ensures each agent can only have one redistribution event per belief per epoch. Prevents double-counting if redistribution is called twice.';

-- Create index to speed up idempotency checks
CREATE INDEX IF NOT EXISTS idx_stake_redistribution_belief_epoch
ON stake_redistribution_events(belief_id, epoch);

COMMENT ON INDEX idx_stake_redistribution_belief_epoch IS
'Speeds up idempotency checks when verifying if redistribution already occurred for a belief/epoch pair';