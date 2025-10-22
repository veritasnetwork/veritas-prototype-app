-- ============================================================================
-- Add Active Belief Tracking for Simplified Stake System
-- ============================================================================
-- Migration Date: 2025-01-24
-- Purpose: Track active belief locks per agent per market for 2% stake system
-- ============================================================================

-- Create table for tracking active belief locks per market
CREATE TABLE agent_active_markets (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  pool_address TEXT NOT NULL,
  last_buy_amount NUMERIC NOT NULL,  -- In USDC lamports
  belief_lock NUMERIC NOT NULL,      -- 2% of last_buy_amount
  belief_id UUID REFERENCES belief_submissions(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (agent_id, pool_address)
);

-- Create indexes for efficient queries
CREATE INDEX idx_agent_active_markets_agent ON agent_active_markets(agent_id);
CREATE INDEX idx_agent_active_markets_pool ON agent_active_markets(pool_address);
CREATE INDEX idx_agent_active_markets_belief ON agent_active_markets(belief_id);

-- Add comments for documentation
COMMENT ON TABLE agent_active_markets IS 'Tracks active belief locks per agent per market. One active belief per agent per pool.';
COMMENT ON COLUMN agent_active_markets.agent_id IS 'Agent who submitted the belief';
COMMENT ON COLUMN agent_active_markets.pool_address IS 'Solana address of the ContentPool';
COMMENT ON COLUMN agent_active_markets.last_buy_amount IS 'USDC amount (in lamports) of most recent buy trade in this market';
COMMENT ON COLUMN agent_active_markets.belief_lock IS 'Required stake lock: 2% of last_buy_amount. Released on epoch settlement or superseded by new belief.';
COMMENT ON COLUMN agent_active_markets.belief_id IS 'Reference to the active belief submission';
COMMENT ON COLUMN agent_active_markets.updated_at IS 'Last time this record was updated (new buy in this market)';

-- ============================================================================
-- Optional: Backfill existing users (commented out - run manually if needed)
-- ============================================================================
-- Populates agent_active_markets from most recent buy trade per agent per pool
--
-- INSERT INTO agent_active_markets (agent_id, pool_address, last_buy_amount, belief_lock, belief_id)
-- SELECT DISTINCT ON (a.id, t.pool_address)
--   a.id AS agent_id,
--   t.pool_address,
--   t.amount_usdc AS last_buy_amount,
--   t.amount_usdc * 0.02 AS belief_lock,
--   bs.id AS belief_id
-- FROM agents a
-- JOIN users u ON u.agent_id = a.id
-- JOIN trades t ON t.user_id = u.id
-- LEFT JOIN belief_submissions bs ON bs.agent_id = a.id
-- WHERE t.trade_type = 'buy'
--   AND t.amount_usdc IS NOT NULL
-- ORDER BY a.id, t.pool_address, t.created_at DESC
-- ON CONFLICT (agent_id, pool_address) DO NOTHING;
