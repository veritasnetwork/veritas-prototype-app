-- ============================================================================
-- Remove Belief Expiration System
-- ============================================================================
-- Migration Date: 2025-01-26
-- Purpose: Remove time-based expiration for beliefs (beliefs now persist indefinitely)
-- ============================================================================

-- Remove expiration_epoch column from beliefs table
ALTER TABLE beliefs
DROP COLUMN IF EXISTS expiration_epoch;

-- Remove status column (no longer needed without expiration)
ALTER TABLE beliefs
DROP COLUMN IF EXISTS status;

-- Remove related config entries
DELETE FROM system_config WHERE key IN ('min_belief_duration', 'max_belief_duration');

-- Remove expiration index
DROP INDEX IF EXISTS idx_beliefs_expires_at_epoch;

-- Drop the expires_at column if it exists (from old schema)
ALTER TABLE beliefs
DROP COLUMN IF EXISTS expires_at;

-- Remove pool expiration tracking (pools now also persist indefinitely)
ALTER TABLE pool_deployments
DROP COLUMN IF EXISTS expiration_timestamp;

ALTER TABLE pool_deployments
DROP COLUMN IF EXISTS last_decay_update;