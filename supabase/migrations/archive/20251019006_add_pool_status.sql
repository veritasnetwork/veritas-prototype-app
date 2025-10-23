-- Add status column to pool_deployments table
-- This tracks the deployment lifecycle: pending, pool_created, market_deployed

ALTER TABLE pool_deployments
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add check constraint for valid statuses
ALTER TABLE pool_deployments
ADD CONSTRAINT pool_deployments_status_check
CHECK (status IN ('pending', 'pool_created', 'market_deployed', 'failed'));

-- Create index for querying by status
CREATE INDEX IF NOT EXISTS idx_pool_deployments_status ON pool_deployments(status);

COMMENT ON COLUMN pool_deployments.status IS 'Deployment status: pending (initial), pool_created (step 1 done), market_deployed (step 2 done), failed';
