-- Phase 1: Make initial belief submission optional
-- Allow posts to be created without initial belief submission
-- Beliefs are still created, but previous_aggregate defaults to 0.5 (neutral)

BEGIN;

-- Make previous_aggregate default to 0.5 (neutral starting point)
ALTER TABLE beliefs
  ALTER COLUMN previous_aggregate SET DEFAULT 0.5;

-- Update constraint to be more explicit (remove and recreate)
ALTER TABLE beliefs
  DROP CONSTRAINT IF EXISTS beliefs_previous_aggregate_check;

ALTER TABLE beliefs
  ADD CONSTRAINT beliefs_previous_aggregate_check
  CHECK (previous_aggregate >= 0 AND previous_aggregate <= 1);

-- Backfill any NULL values (shouldn't exist, but safety check)
UPDATE beliefs
SET previous_aggregate = 0.5
WHERE previous_aggregate IS NULL;

-- Verify migration success
DO $$
DECLARE
  default_value TEXT;
BEGIN
  SELECT column_default INTO default_value
  FROM information_schema.columns
  WHERE table_name = 'beliefs'
    AND column_name = 'previous_aggregate';

  IF default_value IS NULL OR default_value NOT LIKE '%0.5%' THEN
    RAISE EXCEPTION 'Migration failed: previous_aggregate default not set correctly';
  END IF;

  RAISE NOTICE 'SUCCESS: previous_aggregate now defaults to 0.5 (neutral)';
END $$;

COMMIT;
