-- Add current_epoch to pool_deployments for per-pool epoch tracking
-- Each pool maintains its own epoch counter that increments on settlement

ALTER TABLE pool_deployments
ADD COLUMN current_epoch INTEGER NOT NULL DEFAULT 0;

-- Create index for querying pools by epoch
CREATE INDEX idx_pool_deployments_current_epoch ON pool_deployments(current_epoch);

-- Update comment
COMMENT ON COLUMN pool_deployments.current_epoch IS 'Current epoch for this pool (increments on settlement, independent per-pool counter)';
