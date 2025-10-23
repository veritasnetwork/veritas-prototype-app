-- ============================================================================
-- Add Pool Decay Tracking Fields
-- ============================================================================
-- Migration Date: 2025-01-24
-- Purpose: Track expiration and decay timestamps for time-based pool decay
-- ============================================================================

-- Add decay tracking fields to pool_deployments
ALTER TABLE pool_deployments
ADD COLUMN expiration_timestamp BIGINT,
ADD COLUMN last_decay_update BIGINT;

-- Add helpful comments
COMMENT ON COLUMN pool_deployments.expiration_timestamp IS 'Unix timestamp when belief expires and decay begins';
COMMENT ON COLUMN pool_deployments.last_decay_update IS 'Unix timestamp of last on-chain decay execution';

-- Backfill existing pools using deployment time
-- Assumes 30 days (2592000 seconds) duration for all beliefs
UPDATE pool_deployments
SET
  expiration_timestamp = EXTRACT(EPOCH FROM deployed_at)::BIGINT + 2592000,
  last_decay_update = EXTRACT(EPOCH FROM deployed_at)::BIGINT + 2592000;

-- Ensure all pools have values (in case some were NULL)
UPDATE pool_deployments
SET
  expiration_timestamp = COALESCE(expiration_timestamp, EXTRACT(EPOCH FROM (deployed_at + INTERVAL '30 days'))::BIGINT),
  last_decay_update = COALESCE(last_decay_update, EXTRACT(EPOCH FROM (deployed_at + INTERVAL '30 days'))::BIGINT)
WHERE expiration_timestamp IS NULL OR last_decay_update IS NULL;

-- Make columns NOT NULL after backfill (with default for new rows)
ALTER TABLE pool_deployments
ALTER COLUMN expiration_timestamp SET DEFAULT 0,
ALTER COLUMN last_decay_update SET DEFAULT 0;

-- For new pools, these will be set by the create_pool instruction
-- For testing/dev, you can manually update them:
-- UPDATE pool_deployments SET expiration_timestamp = EXTRACT(EPOCH FROM NOW()) + 86400 WHERE expiration_timestamp = 0;
