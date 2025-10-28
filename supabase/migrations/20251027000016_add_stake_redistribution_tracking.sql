-- Track stake redistribution events (rewards and penalties from BTS)
-- This provides a complete audit trail for all stake changes

CREATE TABLE IF NOT EXISTS stake_redistribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  belief_id uuid NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  epoch integer NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT NOW(),

  -- Per-agent redistribution
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- BTS scores and weights
  information_score numeric(10, 8) NOT NULL CHECK (information_score >= -1 AND information_score <= 1),
  belief_weight numeric NOT NULL CHECK (belief_weight >= 0),
  normalized_weight numeric NOT NULL CHECK (normalized_weight >= 0 AND normalized_weight <= 1),

  -- Stake changes
  stake_before bigint NOT NULL CHECK (stake_before >= 0),  -- micro-USDC
  stake_delta bigint NOT NULL,  -- Can be negative (penalty) or positive (reward), micro-USDC
  stake_after bigint NOT NULL CHECK (stake_after >= 0),  -- micro-USDC

  -- Event source tracking
  recorded_by text NOT NULL DEFAULT 'server' CHECK (recorded_by IN ('server', 'indexer')),

  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_stake_redistribution_agent ON stake_redistribution_events(agent_id);
CREATE INDEX idx_stake_redistribution_belief ON stake_redistribution_events(belief_id);
CREATE INDEX idx_stake_redistribution_epoch ON stake_redistribution_events(epoch);
CREATE INDEX idx_stake_redistribution_processed_at ON stake_redistribution_events(processed_at);

-- Index for reconciliation queries (get all events for an agent)
CREATE INDEX idx_stake_redistribution_agent_time ON stake_redistribution_events(agent_id, processed_at);

COMMENT ON TABLE stake_redistribution_events IS 'Audit trail of all stake redistributions from BTS scoring. Each row represents a reward (positive delta) or penalty (negative delta) for one agent in one epoch.';
COMMENT ON COLUMN stake_redistribution_events.information_score IS 'BTS information score for this agent, range [-1, 1]';
COMMENT ON COLUMN stake_redistribution_events.belief_weight IS 'Raw belief weight (2% of last trade amount in micro-USDC)';
COMMENT ON COLUMN stake_redistribution_events.normalized_weight IS 'Normalized weight (sums to 1.0 across all agents)';
COMMENT ON COLUMN stake_redistribution_events.stake_delta IS 'Change in stake: positive = reward, negative = penalty (micro-USDC)';
