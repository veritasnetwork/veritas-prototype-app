-- Consolidate reserve column naming
-- Issue: Migration 20250130 created 'reserve', migration 20250208 created 'reserve_balance'
-- This creates confusion about which column to use
-- Decision: Keep 'reserve' (matches Solana program field name), remove 'reserve_balance'

-- Check if reserve_balance has any data that reserve doesn't
DO $$
BEGIN
    -- If reserve_balance exists and has data that reserve doesn't, copy it over
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pool_deployments'
        AND column_name = 'reserve_balance'
    ) THEN
        -- Copy any non-null reserve_balance values to reserve where reserve is null or 0
        UPDATE pool_deployments
        SET reserve = reserve_balance
        WHERE (reserve IS NULL OR reserve = 0)
          AND reserve_balance IS NOT NULL
          AND reserve_balance != 0;

        RAISE NOTICE 'Copied reserve_balance data to reserve column';
    END IF;
END $$;

-- Drop reserve_balance column if it exists (IF EXISTS was added in PG 14)
ALTER TABLE pool_deployments
DROP COLUMN IF EXISTS reserve_balance;

-- Ensure reserve column exists (in case migrations ran out of order)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pool_deployments'
        AND column_name = 'reserve'
    ) THEN
        ALTER TABLE pool_deployments
        ADD COLUMN reserve NUMERIC DEFAULT 0;

        RAISE NOTICE 'Added reserve column';
    END IF;
END $$;

-- Update comment to be clear
COMMENT ON COLUMN pool_deployments.reserve IS 'Cached USDC reserve balance from Solana ContentPool.reserve (in micro-USDC, 6 decimals)';

-- Log the fix
DO $$
BEGIN
    RAISE NOTICE 'Column naming consolidated: Using "reserve" (matches Solana struct), removed "reserve_balance"';
END $$;
