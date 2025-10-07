-- Add epoch timing and cron management fields to system_config
-- Based on specs/edge-function-specs/03-epoch-cron-management.md

-- Add timing fields to system_config
INSERT INTO system_config (key, value) VALUES
    ('current_epoch_start_time', '2025-09-15T10:00:00.000Z'),
    ('next_epoch_deadline', '2025-09-15T11:00:00.000Z'),
    ('cron_job_id', ''),
    ('cron_last_run', ''),
    ('cron_next_run', ''),
    ('cron_status', 'stopped');

-- Create epoch_history table to track epoch transitions and timing accuracy
CREATE TABLE epoch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_number INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  scheduled_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds INTEGER,
  processing_triggered_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_duration_ms INTEGER,
  beliefs_processed INTEGER DEFAULT 0,
  beliefs_expired INTEGER DEFAULT 0,
  cron_triggered BOOLEAN DEFAULT false,
  manual_triggered BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('active', 'completed', 'failed', 'timeout')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for epoch_history
CREATE INDEX idx_epoch_history_epoch_number ON epoch_history(epoch_number);
CREATE INDEX idx_epoch_history_status ON epoch_history(status);
CREATE INDEX idx_epoch_history_started_at ON epoch_history(started_at);

-- Install pg_cron extension for cron job management
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add constraints
ALTER TABLE epoch_history ADD CONSTRAINT epoch_history_epoch_number_positive CHECK (epoch_number >= 0);
ALTER TABLE epoch_history ADD CONSTRAINT epoch_history_duration_positive CHECK (scheduled_duration_seconds > 0);
ALTER TABLE epoch_history ADD CONSTRAINT epoch_history_timing_consistent CHECK (
  (ended_at IS NULL OR ended_at >= started_at) AND
  (processing_completed_at IS NULL OR processing_triggered_at IS NULL OR processing_completed_at >= processing_triggered_at)
);