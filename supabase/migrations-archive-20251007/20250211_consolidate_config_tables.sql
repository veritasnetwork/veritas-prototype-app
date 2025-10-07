-- ============================================================================
-- Consolidate Config Tables
-- ============================================================================
-- Merges 'configs' table into 'system_config' as single source of truth
-- Adds description and created_at columns for better documentation
-- Removes obsolete pool bonding curve parameters
-- ============================================================================

BEGIN;

-- 1. Enhance system_config schema with description and created_at
ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Migrate data from configs to system_config (if configs exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'configs') THEN
    INSERT INTO system_config (key, value, description, created_at, updated_at)
    SELECT key, value, description, created_at, updated_at
    FROM configs
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- 3. Backfill descriptions for existing system_config keys
UPDATE system_config SET description = 'Global epoch counter for protocol processing' WHERE key = 'current_epoch' AND description IS NULL;
UPDATE system_config SET description = 'Duration of each epoch in seconds (3600 = 1 hour, 30 for testing)' WHERE key = 'epoch_duration_seconds' AND description IS NULL;
UPDATE system_config SET description = 'Whether automatic epoch processing is enabled' WHERE key = 'epoch_processing_enabled' AND description IS NULL;
UPDATE system_config SET description = 'How epochs are triggered: cron, manual, or event-driven' WHERE key = 'epoch_processing_trigger' AND description IS NULL;
UPDATE system_config SET description = 'Minimum participants required for BTS scoring' WHERE key = 'min_participants_for_scoring' AND description IS NULL;
UPDATE system_config SET description = 'Minimum stake allocated per belief (USD)' WHERE key = 'min_stake_per_belief' AND description IS NULL;
UPDATE system_config SET description = 'Default stake amount for new agents (USD)' WHERE key = 'initial_agent_stake' AND description IS NULL;
UPDATE system_config SET description = 'Minimum belief market duration in epochs' WHERE key = 'min_belief_duration' AND description IS NULL;
UPDATE system_config SET description = 'Maximum belief market duration in epochs' WHERE key = 'max_belief_duration' AND description IS NULL;
UPDATE system_config SET description = 'Maximum number of beliefs per agent' WHERE key = 'max_beliefs_per_agent' AND description IS NULL;
UPDATE system_config SET description = 'Maximum number of agents per belief market' WHERE key = 'max_agents_per_belief' AND description IS NULL;
UPDATE system_config SET description = 'Timestamp of first epoch start' WHERE key = 'epoch_start_time' AND description IS NULL;
UPDATE system_config SET description = 'Next scheduled epoch target time' WHERE key = 'epoch_next_target_time' AND description IS NULL;

-- 4. Remove obsolete pool bonding curve parameters (from piecewise -> pure quadratic migration)
DELETE FROM system_config WHERE key IN (
  'default_pool_k_quadratic',
  'default_pool_reserve_cap',
  'default_pool_linear_slope',
  'default_pool_virtual_liquidity',
  'default_pool_supply_offset'
);

-- 5. Drop configs table
DROP TABLE IF EXISTS configs;

COMMIT;
