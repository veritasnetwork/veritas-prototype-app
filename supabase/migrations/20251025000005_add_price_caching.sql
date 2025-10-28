-- Add price caching columns to pool_deployments
-- These will be updated periodically by a background job for fast holdings loading

ALTER TABLE pool_deployments
ADD COLUMN IF NOT EXISTS cached_price_long numeric,
ADD COLUMN IF NOT EXISTS cached_price_short numeric,
ADD COLUMN IF NOT EXISTS prices_last_updated_at timestamp with time zone;

-- Add index for efficient queries by prices_last_updated_at
CREATE INDEX IF NOT EXISTS idx_pool_deployments_prices_updated
ON pool_deployments(prices_last_updated_at)
WHERE prices_last_updated_at IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN pool_deployments.cached_price_long IS 'Cached LONG token price in USDC (updated periodically for fast queries)';
COMMENT ON COLUMN pool_deployments.cached_price_short IS 'Cached SHORT token price in USDC (updated periodically for fast queries)';
COMMENT ON COLUMN pool_deployments.prices_last_updated_at IS 'When cached prices were last updated from on-chain data';
