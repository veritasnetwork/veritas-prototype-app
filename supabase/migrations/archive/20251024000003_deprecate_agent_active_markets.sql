-- ============================================================================
-- Deprecate agent_active_markets and active_belief_count
-- ============================================================================
-- Migration Date: 2025-01-24
-- Purpose: Remove deprecated stake tracking tables/columns after migration
-- IMPORTANT: Only run after verifying all code has been updated to use user_pool_balances
-- ============================================================================

-- Drop agent_active_markets table (replaced by user_pool_balances)
DROP TABLE IF EXISTS agent_active_markets CASCADE;

-- Drop active_belief_count column from agents (replaced by counting open positions)
ALTER TABLE agents DROP COLUMN IF EXISTS active_belief_count;

-- Add comment noting the change
COMMENT ON TABLE agents IS 'Protocol-level agents with Solana wallet integration and stake tracking. Stake locks tracked per-pool in user_pool_balances.';
