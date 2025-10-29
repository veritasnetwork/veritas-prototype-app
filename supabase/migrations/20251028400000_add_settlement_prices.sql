-- Add price tracking columns to settlements table
-- These capture the post-settlement prices from on-chain pool state

ALTER TABLE settlements
ADD COLUMN sqrt_price_long_x96_after TEXT,
ADD COLUMN sqrt_price_short_x96_after TEXT,
ADD COLUMN price_long_after NUMERIC,
ADD COLUMN price_short_after NUMERIC;

COMMENT ON COLUMN settlements.sqrt_price_long_x96_after IS 'Sqrt price for LONG tokens after settlement (X96 format from chain)';
COMMENT ON COLUMN settlements.sqrt_price_short_x96_after IS 'Sqrt price for SHORT tokens after settlement (X96 format from chain)';
COMMENT ON COLUMN settlements.price_long_after IS 'Human-readable LONG price in USDC per token after settlement';
COMMENT ON COLUMN settlements.price_short_after IS 'Human-readable SHORT price in USDC per token after settlement';