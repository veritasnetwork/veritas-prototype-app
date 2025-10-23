-- COMPREHENSIVE CLEANUP: Remove all deprecated bonding curve fields
-- This migration removes fields from the old quadratic bonding curve implementation
-- that are no longer used in the ICBS (Impermanent Constant Baseline Swap) market

BEGIN;

-- ========================================
-- pool_deployments table cleanup
-- ========================================

-- Drop old bonding curve fields that are NOT used in ICBS
ALTER TABLE pool_deployments
  DROP COLUMN IF EXISTS usdc_vault_address,
  DROP COLUMN IF EXISTS token_mint_address;

-- Add comments to clarify ICBS fields
COMMENT ON COLUMN pool_deployments.long_mint_address IS 'SPL token mint for LONG tokens (created on pool initialization)';
COMMENT ON COLUMN pool_deployments.short_mint_address IS 'SPL token mint for SHORT tokens (created on pool initialization)';
COMMENT ON COLUMN pool_deployments.status IS 'Deployment lifecycle: pending (initial), pool_created (step 1), market_deployed (step 2), failed';

-- ========================================
-- Update any functions/views that reference old fields
-- ========================================

-- Drop and recreate get_pool_with_stats function if it exists
DROP FUNCTION IF EXISTS get_pool_with_stats(UUID);

CREATE OR REPLACE FUNCTION get_pool_with_stats(p_post_id UUID)
RETURNS TABLE (
  pool_address TEXT,
  long_mint_address TEXT,
  short_mint_address TEXT,
  market_address TEXT,
  status TEXT,
  deployed_at TIMESTAMPTZ,
  pool_created_at TIMESTAMPTZ,
  market_deployed_at TIMESTAMPTZ,
  -- ICBS parameters
  fee_rate_bps INTEGER,
  strike_ratio_num BIGINT,
  strike_ratio_den BIGINT,
  -- Stats
  total_long_supply NUMERIC,
  total_short_supply NUMERIC,
  total_usdc_reserve NUMERIC,
  sqrt_price_long NUMERIC,
  sqrt_price_short NUMERIC,
  last_synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.pool_address,
    pd.long_mint_address,
    pd.short_mint_address,
    pd.market_address,
    pd.status,
    pd.deployed_at,
    pd.pool_created_at,
    pd.market_deployed_at,
    pd.fee_rate_bps,
    pd.strike_ratio_num,
    pd.strike_ratio_den,
    pd.total_long_supply,
    pd.total_short_supply,
    pd.total_usdc_reserve,
    pd.sqrt_price_long,
    pd.sqrt_price_short,
    pd.last_synced_at
  FROM pool_deployments pd
  WHERE pd.post_id = p_post_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_pool_with_stats IS 'Get pool deployment info and stats for a post (ICBS version)';

COMMIT;
