-- Migration: Align trades table with ICBS two-sided market model
-- Adds 'side' column (LONG/SHORT), human-readable prices
-- Marks deprecated single-sided bonding curve fields

BEGIN;

-- ============================================================================
-- PART 1: Add Critical ICBS Fields
-- ============================================================================

-- Add 'side' column - critical for two-sided markets
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('LONG', 'SHORT', NULL));

COMMENT ON COLUMN trades.side IS 'Which token was traded: LONG (bullish) or SHORT (bearish). NULL for legacy trades or liquidity provision.';

-- Make side required for new trades (but allow NULL for existing trades)
-- We'll backfill NULL values in a later migration after verifying data

-- ============================================================================
-- PART 2: Add Human-Readable Price Fields
-- ============================================================================

-- Add decimal price fields for UI display (computed from sqrt_price_x96)
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS price_long NUMERIC,
  ADD COLUMN IF NOT EXISTS price_short NUMERIC;

COMMENT ON COLUMN trades.price_long IS 'LONG token price in USDC at time of trade (human-readable, computed from sqrt_price_long_x96)';
COMMENT ON COLUMN trades.price_short IS 'SHORT token price in USDC at time of trade (human-readable, computed from sqrt_price_short_x96)';

-- ============================================================================
-- PART 3: Add Supply Snapshots for ICBS
-- ============================================================================

-- Token supply snapshots for both sides (replaces old single-sided supply)
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS s_long_before NUMERIC,
  ADD COLUMN IF NOT EXISTS s_long_after NUMERIC,
  ADD COLUMN IF NOT EXISTS s_short_before NUMERIC,
  ADD COLUMN IF NOT EXISTS s_short_after NUMERIC;

COMMENT ON COLUMN trades.s_long_before IS 'LONG token supply before this trade (atomic units)';
COMMENT ON COLUMN trades.s_long_after IS 'LONG token supply after this trade (atomic units)';
COMMENT ON COLUMN trades.s_short_before IS 'SHORT token supply before this trade (atomic units)';
COMMENT ON COLUMN trades.s_short_after IS 'SHORT token supply after this trade (atomic units)';

-- Virtual reserve snapshots (optional, for analytics)
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS r_long_before NUMERIC,
  ADD COLUMN IF NOT EXISTS r_long_after NUMERIC,
  ADD COLUMN IF NOT EXISTS r_short_before NUMERIC,
  ADD COLUMN IF NOT EXISTS r_short_after NUMERIC;

COMMENT ON COLUMN trades.r_long_before IS 'LONG virtual reserve before this trade (R_L = s_L × p_L)';
COMMENT ON COLUMN trades.r_long_after IS 'LONG virtual reserve after this trade';
COMMENT ON COLUMN trades.r_short_before IS 'SHORT virtual reserve before this trade (R_S = s_S × p_S)';
COMMENT ON COLUMN trades.r_short_after IS 'SHORT virtual reserve after this trade';

-- ============================================================================
-- PART 4: Create Indexes
-- ============================================================================

-- Index for filtering by side
CREATE INDEX IF NOT EXISTS idx_trades_side ON trades(side) WHERE side IS NOT NULL;

-- Index for LONG trades
CREATE INDEX IF NOT EXISTS idx_trades_long ON trades(pool_address, recorded_at DESC)
  WHERE side = 'LONG';

-- Index for SHORT trades
CREATE INDEX IF NOT EXISTS idx_trades_short ON trades(pool_address, recorded_at DESC)
  WHERE side = 'SHORT';

-- ============================================================================
-- PART 5: Mark Deprecated Columns (if they still exist)
-- ============================================================================

-- These columns are from the old quadratic bonding curve model
-- Keep them for backward compatibility but mark as deprecated
-- Some may have been dropped by previous migrations

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trades' AND column_name = 'token_supply_before') THEN
    COMMENT ON COLUMN trades.token_supply_before IS 'DEPRECATED: Old single-sided token supply. Use s_long_before/s_short_before instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trades' AND column_name = 'token_supply_after') THEN
    COMMENT ON COLUMN trades.token_supply_after IS 'DEPRECATED: Old single-sided token supply. Use s_long_after/s_short_after instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trades' AND column_name = 'reserve_before') THEN
    COMMENT ON COLUMN trades.reserve_before IS 'DEPRECATED: Old single-sided reserve. Use r_long_before/r_short_before instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trades' AND column_name = 'reserve_after') THEN
    COMMENT ON COLUMN trades.reserve_after IS 'DEPRECATED: Old single-sided reserve. Use r_long_after/r_short_after instead.';
  END IF;
END $$;

-- ============================================================================
-- PART 6: Update Constraints
-- ============================================================================

-- Update trade_type check to include liquidity_provision (already added in another migration)
-- Verify it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trades_trade_type_check'
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_trade_type_check
      CHECK (trade_type IN ('buy', 'sell', 'liquidity_provision'));
  END IF;
END $$;

-- ============================================================================
-- PART 7: Backfill Logic for Existing Trades (Safe Defaults)
-- ============================================================================

-- For existing trades without 'side', we can infer it from context:
-- 1. If it's a 'buy' on the old system, it was always LONG (no SHORT existed)
-- 2. Liquidity provision trades should stay NULL (they're neutral)

-- Backfill side for old trades (before two-sided markets)
UPDATE trades
SET side = CASE
  WHEN trade_type = 'liquidity_provision' THEN NULL
  WHEN trade_type IN ('buy', 'sell') AND side IS NULL THEN 'LONG'
  ELSE side
END
WHERE side IS NULL;

-- Backfill ICBS prices from price_per_token for old trades (if column exists)
-- Old trades only had one price, assign it to LONG side
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trades' AND column_name = 'price_per_token') THEN
    UPDATE trades
    SET
      price_long = price_per_token,
      price_short = 0
    WHERE price_long IS NULL AND price_per_token IS NOT NULL;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================

-- After this migration:
-- 1. Update trade recording API to include 'side' field (REQUIRED for new trades)
-- 2. Update event indexer to populate price_long and price_short from on-chain events
-- 3. Update UI to display separate LONG/SHORT prices
-- 4. Consider making 'side' NOT NULL for trade_type='buy' or 'sell' in future migration

COMMENT ON TABLE trades IS 'Individual trades for ICBS two-sided markets. Tracks buy/sell of LONG (bullish) or SHORT (bearish) tokens. Supports dual-source indexing (server + on-chain events).';
