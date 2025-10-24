-- Migration: Add implied relevance history tracking
-- Purpose: Track market-implied relevance (from reserves) alongside actual BD scores
-- This allows us to visualize trader predictions vs ground truth

CREATE TABLE implied_relevance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

  -- Implied relevance calculated from reserves: reserve_long / (reserve_long + reserve_short)
  -- Range: 0-1 where 0.5 = neutral, >0.5 = bullish, <0.5 = bearish
  implied_relevance NUMERIC NOT NULL CHECK (implied_relevance >= 0 AND implied_relevance <= 1),

  -- Reserve state at time of recording (in USDC display units)
  reserve_long NUMERIC NOT NULL CHECK (reserve_long >= 0),
  reserve_short NUMERIC NOT NULL CHECK (reserve_short >= 0),

  -- Event that triggered this recording
  event_type TEXT NOT NULL CHECK (event_type IN ('trade', 'deployment', 'rebase')),
  event_reference TEXT NOT NULL, -- Transaction signature, pool address, etc.

  -- Confirmation tracking (mirrors trades table pattern)
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by TEXT NOT NULL DEFAULT 'server', -- 'server' or 'indexer'

  -- Timestamp
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: One record per event reference (tx signature or pool address)
  UNIQUE(event_reference)
);

-- Indexes for fast queries
CREATE INDEX idx_implied_relevance_post_time ON implied_relevance_history(post_id, recorded_at DESC);
CREATE INDEX idx_implied_relevance_belief_time ON implied_relevance_history(belief_id, recorded_at DESC);
CREATE INDEX idx_implied_relevance_event_type ON implied_relevance_history(event_type);

-- Add comment explaining the table
COMMENT ON TABLE implied_relevance_history IS 'Tracks market-implied relevance over time based on reserve ratios. Used to compare trader predictions against actual BD relevance scores.';
COMMENT ON COLUMN implied_relevance_history.implied_relevance IS 'Market-implied relevance: reserve_long / (reserve_long + reserve_short). Shows what traders collectively predict the relevance to be.';