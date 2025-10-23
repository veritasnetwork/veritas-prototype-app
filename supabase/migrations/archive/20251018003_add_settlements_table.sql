-- Settlement records table (output from on-chain settlement events)
-- Tracks historical pool settlements for analytics and auditing

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    pool_address TEXT NOT NULL,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    -- Settlement data
    epoch INTEGER NOT NULL,
    bd_relevance_score DECIMAL NOT NULL CHECK (bd_relevance_score >= 0 AND bd_relevance_score <= 1),
    market_prediction_q DECIMAL NOT NULL CHECK (market_prediction_q >= 0 AND market_prediction_q <= 1),

    -- Settlement factors
    f_long DECIMAL NOT NULL CHECK (f_long >= 0),
    f_short DECIMAL NOT NULL CHECK (f_short >= 0),

    -- Reserve changes (for analytics)
    reserve_long_before BIGINT NOT NULL,
    reserve_long_after BIGINT NOT NULL,
    reserve_short_before BIGINT NOT NULL,
    reserve_short_after BIGINT NOT NULL,

    -- Event tracking
    tx_signature TEXT UNIQUE,
    recorded_by TEXT NOT NULL DEFAULT 'indexer' CHECK (recorded_by IN ('indexer', 'manual')),
    confirmed BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one settlement per pool per epoch
    UNIQUE(pool_address, epoch)
);

-- Indexes for common queries
CREATE INDEX idx_settlements_pool ON settlements(pool_address);
CREATE INDEX idx_settlements_belief ON settlements(belief_id);
CREATE INDEX idx_settlements_post ON settlements(post_id);
CREATE INDEX idx_settlements_epoch ON settlements(epoch);
CREATE INDEX idx_settlements_timestamp ON settlements(timestamp DESC);
CREATE INDEX idx_settlements_tx ON settlements(tx_signature);

-- Comments
COMMENT ON TABLE settlements IS 'Historical record of pool settlements from on-chain SettlementEvent';
COMMENT ON COLUMN settlements.bd_relevance_score IS 'BD (Belief Decomposition) relevance score x ∈ [0,1] used for settlement';
COMMENT ON COLUMN settlements.market_prediction_q IS 'Market prediction q = R_long / (R_long + R_short) before settlement';
COMMENT ON COLUMN settlements.f_long IS 'Settlement factor for LONG side: f_long = x / q';
COMMENT ON COLUMN settlements.f_short IS 'Settlement factor for SHORT side: f_short = (1-x) / (1-q)';
COMMENT ON COLUMN settlements.reserve_long_before IS 'LONG reserve in micro-USDC before settlement';
COMMENT ON COLUMN settlements.reserve_long_after IS 'LONG reserve in micro-USDC after settlement';
COMMENT ON COLUMN settlements.reserve_short_before IS 'SHORT reserve in micro-USDC before settlement';
COMMENT ON COLUMN settlements.reserve_short_after IS 'SHORT reserve in micro-USDC after settlement';
COMMENT ON COLUMN settlements.recorded_by IS 'Source that recorded this settlement: indexer (event-processor) or manual';
COMMENT ON COLUMN settlements.confirmed IS 'Whether settlement transaction was confirmed on-chain';
