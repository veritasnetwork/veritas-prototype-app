-- Remove invalid constraint on information_score
-- BTS scores are unbounded (KL divergence can be arbitrarily large)

BEGIN;

-- Drop the check constraint
ALTER TABLE stake_redistribution_events
  DROP CONSTRAINT IF EXISTS stake_redistribution_events_information_score_check;

-- Change column type from numeric(10,8) to unbounded numeric
ALTER TABLE stake_redistribution_events
  ALTER COLUMN information_score TYPE NUMERIC;

COMMENT ON COLUMN stake_redistribution_events.information_score IS
  'Raw BTS score (unbounded). Represents information contribution via KL divergence. Typically in range [-10, +10] but can be larger.';

COMMIT;