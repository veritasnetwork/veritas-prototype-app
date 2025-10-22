-- Add dual-source event indexing fields to existing trades table
-- Enables idempotent processing from both server-side recording and blockchain events

BEGIN;

-- Add source tracking fields
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS recorded_by TEXT CHECK (recorded_by IN ('server', 'indexer')) DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS server_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS indexer_corrected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS block_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot BIGINT;

-- Add index for unconfirmed trades (for monitoring)
CREATE INDEX IF NOT EXISTS idx_trades_confirmed ON trades(confirmed) WHERE NOT confirmed;

-- Add index for blockchain metadata
CREATE INDEX IF NOT EXISTS idx_trades_block_time ON trades(block_time) WHERE block_time IS NOT NULL;

-- Comments for new fields
COMMENT ON COLUMN trades.recorded_by IS 'Which system created this record first (server or indexer)';
COMMENT ON COLUMN trades.confirmed IS 'Has on-chain event verified this transaction?';
COMMENT ON COLUMN trades.indexer_corrected IS 'Did indexer overwrite incorrect server data?';
COMMENT ON COLUMN trades.server_amount IS 'Original server amount if indexer corrected it';
COMMENT ON COLUMN trades.confirmed_at IS 'When indexer confirmed this trade';
COMMENT ON COLUMN trades.indexed_at IS 'When event was indexed from blockchain';
COMMENT ON COLUMN trades.block_time IS 'Blockchain timestamp of transaction';
COMMENT ON COLUMN trades.slot IS 'Solana slot number';

COMMIT;
