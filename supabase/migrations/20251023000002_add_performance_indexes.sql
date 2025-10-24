-- Performance optimization indexes
-- These indexes improve query performance for common access patterns

-- Posts: Improve feed queries (ordered by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);

-- Pool deployments: Improve pool sync queries (by post_id and last_synced_at)
CREATE INDEX IF NOT EXISTS idx_pool_deployments_post_sync ON pool_deployments(post_id, last_synced_at);

-- Trades: Improve trade history queries (by post_id and recorded_at DESC)
CREATE INDEX IF NOT EXISTS idx_trades_post_recorded_at ON trades(post_id, recorded_at DESC);

-- Posts: Improve user profile queries (by user_id and created_at DESC)
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- Belief submissions: Improve belief aggregation queries (by belief_id and agent_id)
CREATE INDEX IF NOT EXISTS idx_belief_submissions_belief_agent ON belief_submissions(belief_id, agent_id);
