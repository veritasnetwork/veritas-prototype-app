-- Make legacy trades columns nullable
-- These columns (token_supply_after, reserve_after) were replaced by ICBS-specific columns
-- (s_long_after, s_short_after, r_long_after, r_short_after)
-- but kept for backward compatibility

ALTER TABLE trades
  ALTER COLUMN token_supply_after DROP NOT NULL,
  ALTER COLUMN reserve_after DROP NOT NULL;

-- Add comments explaining these are legacy
COMMENT ON COLUMN trades.token_supply_after IS 'LEGACY: Use s_long_after/s_short_after for ICBS pools';
COMMENT ON COLUMN trades.reserve_after IS 'LEGACY: Use r_long_after/r_short_after for ICBS pools';
