-- Remove obsolete bonding curve parameters from pool_deployments
-- These fields are no longer used after switching to pure quadratic curve

ALTER TABLE pool_deployments
DROP COLUMN IF EXISTS reserve_cap,
DROP COLUMN IF EXISTS linear_slope,
DROP COLUMN IF EXISTS virtual_liquidity;
