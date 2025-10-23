-- Migration: Fix ICBS F parameter to match on-chain implementation
-- The on-chain Rust code uses F=1 (not F=3) for all pools
-- This migration updates existing data and changes the default

BEGIN;

-- Update all existing pool_deployments to use F=1
UPDATE pool_deployments
SET f = 1
WHERE f IS NULL OR f != 1;

-- Update all existing trades to use F=1
UPDATE trades
SET f = 1
WHERE f IS NOT NULL AND f != 1;

-- Change the default value for future records
ALTER TABLE pool_deployments
  ALTER COLUMN f SET DEFAULT 1;

-- Update the comment to reflect the correct value
COMMENT ON COLUMN pool_deployments.f IS 'ICBS growth exponent (FIXED at 1 for all pools)';

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Updated pool_deployments: % rows', (SELECT COUNT(*) FROM pool_deployments WHERE f = 1);
  RAISE NOTICE 'Updated trades: % rows', (SELECT COUNT(*) FROM trades WHERE f = 1);
END $$;

COMMIT;
