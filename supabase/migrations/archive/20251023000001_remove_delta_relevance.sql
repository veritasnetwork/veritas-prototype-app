-- Remove delta_relevance from belief_relevance_history and beliefs tables
-- Delta relevance is deprecated - we only track absolute BD relevance scores

-- Drop delta_relevance from belief_relevance_history
ALTER TABLE belief_relevance_history DROP COLUMN IF EXISTS delta_relevance;

-- Drop delta_relevance from beliefs table
ALTER TABLE beliefs DROP COLUMN IF EXISTS delta_relevance;

-- Drop related index
DROP INDEX IF EXISTS idx_beliefs_delta_relevance;

-- Update system_config to remove delta_relevance references
UPDATE system_config
SET description = 'Base penalty rate for pools (1% = 0.01)'
WHERE key = 'base_skim_rate';

-- Update column comment for aggregate
COMMENT ON COLUMN belief_relevance_history.aggregate IS 'Absolute BD relevance score [0,1] for this epoch (used for pool settlement)';
