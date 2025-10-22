-- Migration: Add sqrt price fields to trades table
-- ICBS markets store prices as sqrt(price) * 2^96, we need to store these for historical data

BEGIN;

-- Add sqrt price columns to trades table
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS sqrt_price_long_x96 TEXT,
  ADD COLUMN IF NOT EXISTS sqrt_price_short_x96 TEXT,
  ADD COLUMN IF NOT EXISTS price_long NUMERIC,
  ADD COLUMN IF NOT EXISTS price_short NUMERIC;

-- Add comments
COMMENT ON COLUMN trades.sqrt_price_long_x96 IS 'LONG token sqrt price in X96 format at time of trade (from on-chain event)';
COMMENT ON COLUMN trades.sqrt_price_short_x96 IS 'SHORT token sqrt price in X96 format at time of trade (from on-chain event)';
COMMENT ON COLUMN trades.price_long IS 'LONG token price in USDC at time of trade (human-readable)';
COMMENT ON COLUMN trades.price_short IS 'SHORT token price in USDC at time of trade (human-readable)';

COMMIT;
