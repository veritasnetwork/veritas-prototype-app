-- Add performance indexes for post detail queries
-- These indexes optimize the most common query patterns:
-- 1. Individual post lookups by ID
-- 2. Pool deployments by post_id
-- 3. Pool sync timestamp checks

-- Index for pool_deployments.post_id (foreign key lookups)
CREATE INDEX IF NOT EXISTS idx_pool_deployments_post_id
ON pool_deployments(post_id);

-- Index for pool_deployments.last_synced_at (stale pool checks)
CREATE INDEX IF NOT EXISTS idx_pool_deployments_last_synced
ON pool_deployments(last_synced_at)
WHERE pool_address IS NOT NULL;

-- Index for posts.created_at (feed ordering)
CREATE INDEX IF NOT EXISTS idx_posts_created_at
ON posts(created_at DESC);

-- Composite index for posts with belief_id (common feed pattern)
CREATE INDEX IF NOT EXISTS idx_posts_belief_created
ON posts(belief_id, created_at DESC)
WHERE belief_id IS NOT NULL;

-- Index for users.username (author lookups)
CREATE INDEX IF NOT EXISTS idx_users_username
ON users(username);
