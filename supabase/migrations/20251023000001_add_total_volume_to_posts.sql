-- Migration: Add total_volume_usdc to posts table
-- This caches the all-time total trading volume (in USDC) for each post's pool
-- Updated by event processor on each trade

-- Add total_volume_usdc column to posts
ALTER TABLE posts
ADD COLUMN total_volume_usdc NUMERIC(20, 6) DEFAULT 0;

-- Add index for sorting by volume
CREATE INDEX idx_posts_total_volume ON posts(total_volume_usdc DESC);

-- Add comment
COMMENT ON COLUMN posts.total_volume_usdc IS 'Cached all-time total trading volume in USDC (sum of all buy and sell amounts)';
