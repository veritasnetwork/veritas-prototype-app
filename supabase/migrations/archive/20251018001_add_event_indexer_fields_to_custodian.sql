-- Add dual-source event indexing fields to custodian tables
-- Enables idempotent processing from both server-side recording and blockchain events

BEGIN;

-- Add fields to custodian_deposits
ALTER TABLE custodian_deposits
  ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('trade_skim', 'direct')) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS recorded_by TEXT CHECK (recorded_by IN ('server', 'indexer')) DEFAULT 'indexer',
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;

-- Add fields to custodian_withdrawals
ALTER TABLE custodian_withdrawals
  ADD COLUMN IF NOT EXISTS recorded_by TEXT CHECK (recorded_by IN ('server', 'indexer')) DEFAULT 'indexer',
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;

-- Comments
COMMENT ON COLUMN custodian_deposits.deposit_type IS 'Whether deposit came from trade skim or direct deposit';
COMMENT ON COLUMN custodian_deposits.recorded_by IS 'Which system created this record first (server or indexer)';
COMMENT ON COLUMN custodian_deposits.confirmed IS 'Has on-chain event verified this transaction?';
COMMENT ON COLUMN custodian_withdrawals.recorded_by IS 'Which system created this record first (server or indexer)';
COMMENT ON COLUMN custodian_withdrawals.confirmed IS 'Has on-chain event verified this transaction?';

COMMIT;
