-- Create belief_relevance_history table for time-series tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'belief_relevance_history') THEN
    CREATE TABLE belief_relevance_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
      epoch INTEGER NOT NULL,
      aggregate DECIMAL NOT NULL CHECK (aggregate >= 0 AND aggregate <= 1),
      delta_relevance DECIMAL NOT NULL,
      certainty DECIMAL NOT NULL CHECK (certainty >= 0 AND certainty <= 1),
      disagreement_entropy DECIMAL NOT NULL CHECK (disagreement_entropy >= 0),
      participant_count INTEGER NOT NULL CHECK (participant_count >= 0),
      total_stake DECIMAL NOT NULL DEFAULT 0 CHECK (total_stake >= 0),
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Ensure one record per belief per epoch
      UNIQUE (belief_id, epoch)
    );

    -- Create indexes for efficient querying
    CREATE INDEX idx_belief_relevance_history_belief_id ON belief_relevance_history(belief_id);
    CREATE INDEX idx_belief_relevance_history_epoch ON belief_relevance_history(epoch);
    CREATE INDEX idx_belief_relevance_history_recorded_at ON belief_relevance_history(recorded_at);

    -- Add comment explaining the table's purpose
    COMMENT ON TABLE belief_relevance_history IS 'Time-series log of aggregate relevance changes per belief per epoch for charting and trend analysis';
    COMMENT ON COLUMN belief_relevance_history.aggregate IS 'Aggregate belief value (weighted average of submissions) for this epoch';
    COMMENT ON COLUMN belief_relevance_history.delta_relevance IS 'Change from previous epoch (aggregate - previous_aggregate)';
    COMMENT ON COLUMN belief_relevance_history.certainty IS 'Certainty metric derived from disagreement entropy (1 - D_JS_norm)';
    COMMENT ON COLUMN belief_relevance_history.disagreement_entropy IS 'Jensen-Shannon disagreement entropy from BD/aggregation';
    COMMENT ON COLUMN belief_relevance_history.participant_count IS 'Number of active participants who submitted beliefs this epoch';
    COMMENT ON COLUMN belief_relevance_history.total_stake IS 'Sum of effective stakes allocated to this belief this epoch';
  END IF;
END $$;
