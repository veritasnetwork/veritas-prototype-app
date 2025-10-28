-- Add epoch processing idempotency tracking to prevent stake compounding
-- Problem: If user's settlement tx fails, running epoch processing again would
-- redistribute stakes AGAIN using the same data, causing unfair compounding.
-- Solution: Track last processed epoch and skip if already processed.

-- Add last_processed_epoch to beliefs table
ALTER TABLE beliefs
ADD COLUMN IF NOT EXISTS last_processed_epoch INTEGER DEFAULT NULL;

COMMENT ON COLUMN beliefs.last_processed_epoch IS
'The last epoch for which this belief was processed (epoch processing run). Prevents reprocessing the same epoch multiple times if settlement transaction fails.';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_beliefs_last_processed_epoch
ON beliefs(last_processed_epoch)
WHERE last_processed_epoch IS NOT NULL;
