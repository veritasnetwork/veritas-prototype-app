-- Migration: Drop k_quadratic columns after ICBS migration
-- All endpoints and components now use ICBS parameters (f, beta_num, beta_den)
-- Prices are fetched from on-chain pool data, not calculated

BEGIN;

-- Drop views that depend on k_quadratic
DROP VIEW IF EXISTS pool_price_snapshots CASCADE;

-- Drop k_quadratic from pool_deployments table
ALTER TABLE pool_deployments
  DROP COLUMN IF EXISTS k_quadratic;

-- Drop k_quadratic from trades table
ALTER TABLE trades
  DROP COLUMN IF EXISTS k_quadratic;

-- Update system_config to remove old k_quadratic config
DELETE FROM system_config WHERE key = 'default_pool_k_quadratic';

COMMIT;
