-- Migration: Align pool_deployments table with ICBS smart contract and spec
-- Adds missing ICBS fields, removes deprecated bonding curve fields
-- Fixes default F value to match smart contract (1 instead of 2 or 3)

BEGIN;

-- ============================================================================
-- PART 1: Add Missing ICBS Fields
-- ============================================================================

-- Lambda parameters (separate for LONG and SHORT sides)
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS sqrt_lambda_long_x96 TEXT,
  ADD COLUMN IF NOT EXISTS sqrt_lambda_short_x96 TEXT;

COMMENT ON COLUMN pool_deployments.sqrt_lambda_long_x96 IS 'ICBS λ parameter for LONG side in X96 fixed-point format';
COMMENT ON COLUMN pool_deployments.sqrt_lambda_short_x96 IS 'ICBS λ parameter for SHORT side in X96 fixed-point format';

-- Initial deployment parameters
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS initial_usdc NUMERIC,
  ADD COLUMN IF NOT EXISTS initial_long_allocation NUMERIC,
  ADD COLUMN IF NOT EXISTS initial_short_allocation NUMERIC;

COMMENT ON COLUMN pool_deployments.initial_usdc IS 'Total USDC deposited at market deployment (micro-USDC, 6 decimals)';
COMMENT ON COLUMN pool_deployments.initial_long_allocation IS 'Initial USDC allocated to LONG side (micro-USDC)';
COMMENT ON COLUMN pool_deployments.initial_short_allocation IS 'Initial USDC allocated to SHORT side (micro-USDC)';

-- Virtual reserves (s_long, s_short) - different from token supply!
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS r_long NUMERIC,
  ADD COLUMN IF NOT EXISTS r_short NUMERIC;

COMMENT ON COLUMN pool_deployments.r_long IS 'Virtual reserve for LONG side: R_L = s_L × p_L (cached from on-chain)';
COMMENT ON COLUMN pool_deployments.r_short IS 'Virtual reserve for SHORT side: R_S = s_S × p_S (cached from on-chain)';

-- Market deployment tracking (separate from pool creation)
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS market_deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS market_deployment_tx_signature TEXT;

COMMENT ON COLUMN pool_deployments.market_deployed_at IS 'When deploy_market instruction was executed (initial liquidity added)';
COMMENT ON COLUMN pool_deployments.market_deployment_tx_signature IS 'Transaction signature of deploy_market instruction';

-- Settlement tracking
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS last_settlement_epoch INTEGER,
  ADD COLUMN IF NOT EXISTS last_settlement_tx TEXT;

COMMENT ON COLUMN pool_deployments.last_settlement_epoch IS 'Most recent epoch this pool was settled';
COMMENT ON COLUMN pool_deployments.last_settlement_tx IS 'Transaction signature of most recent settlement';

-- ============================================================================
-- PART 2: Fix Default F Value (3 → 1 to match smart contract)
-- ============================================================================

-- Update default for future inserts
ALTER TABLE pool_deployments
  ALTER COLUMN f SET DEFAULT 1;

-- Update existing rows that have the old default (3) to the correct value (1)
-- Only update if they're exactly 3 (the old default), leave custom values alone
UPDATE pool_deployments
SET f = 1
WHERE f = 3;

COMMENT ON COLUMN pool_deployments.f IS 'ICBS growth exponent (default: 1, reduced from 3 to avoid numerical overflow)';

-- ============================================================================
-- PART 3: Rename supply columns to match smart contract semantics
-- ============================================================================

-- In ICBS, s_long and s_short are token supplies, not reserves
-- The current supply_long/supply_short are correct but poorly named
-- Rename them to s_long/s_short to match smart contract and spec

-- First, check if s_long/s_short exist (from r_long/r_short addition above)
-- If they exist, we need to use different names

-- Use token supply naming that matches smart contract
ALTER TABLE pool_deployments
  RENAME COLUMN supply_long TO s_long_supply;

ALTER TABLE pool_deployments
  RENAME COLUMN supply_short TO s_short_supply;

COMMENT ON COLUMN pool_deployments.s_long_supply IS 'LONG token supply (atomic units, 6 decimals) - from ContentPool.s_long';
COMMENT ON COLUMN pool_deployments.s_short_supply IS 'SHORT token supply (atomic units, 6 decimals) - from ContentPool.s_short';

-- ============================================================================
-- PART 4: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pool_deployments_settlement_epoch
  ON pool_deployments(last_settlement_epoch)
  WHERE last_settlement_epoch IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pool_deployments_market_deployment_tx
  ON pool_deployments(market_deployment_tx_signature)
  WHERE market_deployment_tx_signature IS NOT NULL;

-- ============================================================================
-- PART 5: Mark Deprecated Columns (DO NOT DROP YET)
-- ============================================================================

-- These columns are from the old quadratic bonding curve model
-- Some may have already been dropped by previous migrations (20251019005, 20251019008)
-- Mark any that still exist as deprecated in comments

DO $$
BEGIN
  -- Only add comments if columns still exist
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pool_deployments' AND column_name = 'k_quadratic') THEN
    COMMENT ON COLUMN pool_deployments.k_quadratic IS 'DEPRECATED: Old quadratic curve parameter. Use f, beta_num, beta_den instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pool_deployments' AND column_name = 'token_supply') THEN
    COMMENT ON COLUMN pool_deployments.token_supply IS 'DEPRECATED: Old single-sided token supply. Use s_long_supply and s_short_supply instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pool_deployments' AND column_name = 'reserve') THEN
    COMMENT ON COLUMN pool_deployments.reserve IS 'DEPRECATED: Old single-sided reserve. Use r_long and r_short instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pool_deployments' AND column_name = 'token_mint_address') THEN
    COMMENT ON COLUMN pool_deployments.token_mint_address IS 'DEPRECATED: Old single-sided mint. Use long_mint_address and short_mint_address instead.';
  END IF;
END $$;

-- ============================================================================
-- PART 6: Update pool_status default (if column exists)
-- ============================================================================

-- Ensure pool_status has correct default (added in migration 20251019006)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pool_deployments' AND column_name = 'pool_status') THEN
    ALTER TABLE pool_deployments
      ALTER COLUMN pool_status SET DEFAULT 'active';

    -- Set NULL values to 'active' (pools created before this column existed)
    UPDATE pool_deployments
    SET pool_status = 'active'
    WHERE pool_status IS NULL;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================

-- After this migration:
-- 1. Update API endpoints to populate new fields from on-chain data
-- 2. Update pool sync service to cache sqrt_lambda values
-- 3. Verify all existing pools have correct f value (1, not 3)
-- 4. Plan future migration to drop deprecated columns once code is updated

COMMENT ON TABLE pool_deployments IS 'Tracks ContentPool deployments on Solana. ICBS two-sided market with LONG/SHORT tokens. Schema aligned with ContentPool smart contract v2.';
