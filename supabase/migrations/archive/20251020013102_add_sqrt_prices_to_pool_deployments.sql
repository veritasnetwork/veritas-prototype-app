-- Add sqrt price caching columns to pool_deployments
-- These will be populated from on-chain ContentPool account data

BEGIN;

ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS sqrt_price_long_x96 TEXT,
  ADD COLUMN IF NOT EXISTS sqrt_price_short_x96 TEXT,
  ADD COLUMN IF NOT EXISTS supply_long NUMERIC,
  ADD COLUMN IF NOT EXISTS supply_short NUMERIC,
  ADD COLUMN IF NOT EXISTS vault_balance NUMERIC;

COMMENT ON COLUMN pool_deployments.sqrt_price_long_x96 IS 'Cached LONG token sqrt price in X96 format from on-chain';
COMMENT ON COLUMN pool_deployments.sqrt_price_short_x96 IS 'Cached SHORT token sqrt price in X96 format from on-chain';
COMMENT ON COLUMN pool_deployments.supply_long IS 'Cached LONG token supply (atomic units, 6 decimals)';
COMMENT ON COLUMN pool_deployments.supply_short IS 'Cached SHORT token supply (atomic units, 6 decimals)';
COMMENT ON COLUMN pool_deployments.vault_balance IS 'Cached USDC vault balance (micro-USDC, 6 decimals)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pool_deployments_prices 
  ON pool_deployments(sqrt_price_long_x96, sqrt_price_short_x96) 
  WHERE sqrt_price_long_x96 IS NOT NULL;

COMMIT;
