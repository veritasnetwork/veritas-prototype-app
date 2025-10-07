-- Add token_supply and reserve_balance columns to pool_deployments table for caching on-chain data

ALTER TABLE pool_deployments
ADD COLUMN IF NOT EXISTS token_supply NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add index for efficient querying by sync time
CREATE INDEX IF NOT EXISTS idx_pool_deployments_last_synced
ON pool_deployments(last_synced_at);

-- Add comment
COMMENT ON COLUMN pool_deployments.token_supply IS 'Cached token supply from Solana (in token units, not atomic units)';
COMMENT ON COLUMN pool_deployments.reserve_balance IS 'Cached USDC reserve balance from Solana (in micro-USDC)';
COMMENT ON COLUMN pool_deployments.last_synced_at IS 'Last time pool data was synced from Solana';
