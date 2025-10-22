-- ============================================================================
-- Add Belief Lock Tracking to user_pool_balances
-- ============================================================================
-- Migration Date: 2025-01-24
-- Purpose: Extend user_pool_balances with stake lock tracking for 2% system
-- Replaces: agent_active_markets table (to be deprecated)
-- ============================================================================

-- Add stake lock columns to existing user_pool_balances table
ALTER TABLE user_pool_balances
ADD COLUMN IF NOT EXISTS last_buy_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS belief_lock NUMERIC NOT NULL DEFAULT 0;

-- Create index for efficient queries on open positions
CREATE INDEX IF NOT EXISTS idx_user_pool_balances_user_open
ON user_pool_balances(user_id) WHERE token_balance > 0;

-- Add comments for documentation
COMMENT ON COLUMN user_pool_balances.last_buy_amount IS 'USDC amount (micro-USDC) of most recent buy in this pool - used to calculate belief_lock';
COMMENT ON COLUMN user_pool_balances.belief_lock IS 'Required stake lock: 2% of last_buy_amount. Only enforced while token_balance > 0. Auto-releases on full exit.';

-- ============================================================================
-- Optional: Migrate existing data from agent_active_markets (if it exists)
-- ============================================================================
-- Backfills last_buy_amount and belief_lock from agent_active_markets

DO $$
BEGIN
  -- Check if agent_active_markets table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_active_markets') THEN

    -- Migrate data from agent_active_markets to user_pool_balances
    UPDATE user_pool_balances upb
    SET
      last_buy_amount = aam.last_buy_amount,
      belief_lock = aam.belief_lock,
      updated_at = NOW()
    FROM agent_active_markets aam
    JOIN agents a ON a.id = aam.agent_id
    JOIN users u ON u.agent_id = a.id
    WHERE upb.user_id = u.id
      AND upb.pool_address = aam.pool_address;

    RAISE NOTICE 'Migrated belief locks from agent_active_markets to user_pool_balances';

  ELSE
    RAISE NOTICE 'agent_active_markets table does not exist - skipping migration';
  END IF;
END $$;
