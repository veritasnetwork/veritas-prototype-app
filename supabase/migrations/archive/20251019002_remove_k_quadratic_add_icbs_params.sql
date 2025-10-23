-- Migration: Remove k_quadratic and add ICBS parameters
-- The new ICBS market uses f, beta_num, beta_den instead of k_quadratic

BEGIN;

-- Add new ICBS parameter columns to pool_deployments
-- NOTE: F default was changed from 3 to 1 in migration 20251022000001
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS f INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS beta_num INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS beta_den INTEGER DEFAULT 2;

-- Add comments for new columns
COMMENT ON COLUMN pool_deployments.f IS 'ICBS growth exponent (FIXED at 1 for all pools)';
COMMENT ON COLUMN pool_deployments.beta_num IS 'ICBS β numerator (default: 1)';
COMMENT ON COLUMN pool_deployments.beta_den IS 'ICBS β denominator (default: 2, so β = 0.5)';

-- Remove k_quadratic column (after migration is safe)
-- NOTE: Uncomment this after verifying all code is updated
-- ALTER TABLE pool_deployments DROP COLUMN IF EXISTS k_quadratic;

-- Add new ICBS parameter columns to trades
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS f INTEGER,
  ADD COLUMN IF NOT EXISTS beta_num INTEGER,
  ADD COLUMN IF NOT EXISTS beta_den INTEGER;

-- Add comments for trades columns
COMMENT ON COLUMN trades.f IS 'ICBS growth exponent at time of trade';
COMMENT ON COLUMN trades.beta_num IS 'ICBS β numerator at time of trade';
COMMENT ON COLUMN trades.beta_den IS 'ICBS β denominator at time of trade';

-- Remove k_quadratic from trades (after migration is safe)
-- NOTE: Uncomment this after verifying all code is updated
-- ALTER TABLE trades DROP COLUMN IF EXISTS k_quadratic;

COMMIT;
