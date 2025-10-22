-- Migration: Add separate LONG and SHORT mint addresses for ICBS pools
-- The ICBS ContentPool has two separate token mints for the two-sided market

BEGIN;

-- Add new columns for LONG and SHORT mints
ALTER TABLE pool_deployments
  ADD COLUMN IF NOT EXISTS long_mint_address TEXT,
  ADD COLUMN IF NOT EXISTS short_mint_address TEXT;

-- Add comments for new columns
COMMENT ON COLUMN pool_deployments.long_mint_address IS 'SPL token mint address for LONG tokens';
COMMENT ON COLUMN pool_deployments.short_mint_address IS 'SPL token mint address for SHORT tokens';

-- Migrate existing data if any (assuming token_mint_address was for LONG side)
-- This is a safe assumption since old pools likely only had one side
UPDATE pool_deployments
SET long_mint_address = token_mint_address
WHERE token_mint_address IS NOT NULL AND long_mint_address IS NULL;

-- Make the new columns required for new pools going forward
-- But allow NULL for existing pools during transition
-- Once all pools are migrated, we can make these NOT NULL

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_pool_deployments_long_mint ON pool_deployments(long_mint_address) WHERE long_mint_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pool_deployments_short_mint ON pool_deployments(short_mint_address) WHERE short_mint_address IS NOT NULL;

-- Note: We're not dropping token_mint_address yet to ensure backward compatibility
-- Once we verify all code is updated, we can drop it in a future migration:
-- ALTER TABLE pool_deployments DROP COLUMN token_mint_address;

COMMIT;