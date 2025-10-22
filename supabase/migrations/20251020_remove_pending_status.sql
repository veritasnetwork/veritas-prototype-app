-- Remove 'pending' status from pool_deployments
-- Since we use single-transaction deployment (create_pool + deploy_market),
-- pools go directly to 'market_deployed' status. 'pending' is never used.

BEGIN;

-- Drop the old constraint
ALTER TABLE pool_deployments
DROP CONSTRAINT IF EXISTS pool_deployments_status_check;

-- Add new constraint without 'pending'
ALTER TABLE pool_deployments
ADD CONSTRAINT pool_deployments_status_check
CHECK (status IN ('pool_created', 'market_deployed', 'failed'));

-- Update the comment
COMMENT ON COLUMN pool_deployments.status IS 'Deployment status: pool_created (pool exists but no liquidity), market_deployed (fully deployed with liquidity), failed (deployment failed)';

COMMIT;
