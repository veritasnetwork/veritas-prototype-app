-- Add sigma virtualization fields to pool_deployments
ALTER TABLE pool_deployments
  ADD COLUMN s_scale_long_q64 NUMERIC,
  ADD COLUMN s_scale_short_q64 NUMERIC;

-- Initialize existing pools to 1.0 (Q64 = 2^64)
UPDATE pool_deployments
SET
  s_scale_long_q64 = POW(2::NUMERIC, 64),
  s_scale_short_q64 = POW(2::NUMERIC, 64)
WHERE s_scale_long_q64 IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE pool_deployments
  ALTER COLUMN s_scale_long_q64 SET NOT NULL,
  ALTER COLUMN s_scale_short_q64 SET NOT NULL;

-- Mark old lambda fields as deprecated
COMMENT ON COLUMN pool_deployments.sqrt_lambda_long_x96 IS
  'DEPRECATED: Telemetry only. Lambda is now derived from vault + sigma scales.';
COMMENT ON COLUMN pool_deployments.sqrt_lambda_short_x96 IS
  'DEPRECATED: Telemetry only. Lambda is now derived from vault + sigma scales.';

-- Add sigma columns to settlements
ALTER TABLE settlements
  ADD COLUMN s_scale_long_before NUMERIC,
  ADD COLUMN s_scale_long_after NUMERIC,
  ADD COLUMN s_scale_short_before NUMERIC,
  ADD COLUMN s_scale_short_after NUMERIC;
