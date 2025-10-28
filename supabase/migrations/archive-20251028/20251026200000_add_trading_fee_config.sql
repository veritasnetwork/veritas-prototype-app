-- Add trading fee configuration to system_config
-- Part of Smart Contract Refactor: Authority Model + Trading Fee Split
-- See: docs/SMART_CONTRACT_REFACTOR.md

INSERT INTO system_config (key, value, description) VALUES
  ('trading_fee_bps', '50', 'Trading fee in basis points (50 = 0.5%)'),
  ('creator_split_bps', '10000', 'Percentage of trading fees allocated to post creators (10000 = 100%)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();