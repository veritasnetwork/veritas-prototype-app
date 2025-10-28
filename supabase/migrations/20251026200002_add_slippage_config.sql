-- Add slippage tolerance configuration to system_config
-- Slippage is the maximum acceptable difference between expected and actual trade output
-- Set to 100 basis points (1%) as industry standard for DeFi

INSERT INTO system_config (key, value, description) VALUES
  ('default_slippage_bps', '100', 'Default slippage tolerance for trades in basis points (100 = 1%)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify the insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_config WHERE key = 'default_slippage_bps') THEN
    RAISE EXCEPTION 'Failed to insert default_slippage_bps into system_config';
  END IF;
END $$;
