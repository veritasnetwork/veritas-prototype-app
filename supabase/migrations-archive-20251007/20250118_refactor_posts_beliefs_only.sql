-- Refactor posts to only support posts with beliefs (removing normal posts and multimedia)
-- Changes:
-- 1. Rename opinion_belief_id to belief_id (cleaner naming)
-- 2. Remove media_urls column (no multimedia support)
-- 3. Update system config default duration from 5 epochs (24h) to 10 epochs (48h)
-- 4. Update indexes for new column names

-- Start transaction for atomicity
BEGIN;

-- Step 1: Rename opinion_belief_id column to belief_id
ALTER TABLE posts
RENAME COLUMN opinion_belief_id TO belief_id;

-- Step 2: Remove media_urls column
ALTER TABLE posts
DROP COLUMN IF EXISTS media_urls;

-- Step 3: Ensure belief_id is NOT NULL (it should already be, but let's be explicit)
ALTER TABLE posts
ALTER COLUMN belief_id SET NOT NULL;

-- Step 4: Drop old index and create new one with updated name
DROP INDEX IF EXISTS idx_posts_belief_id;
CREATE INDEX idx_posts_belief_id ON posts(belief_id);

-- Step 5: Update system config for default belief duration from 5 to 10 epochs
UPDATE system_config
SET value = '10', updated_at = NOW()
WHERE key = 'min_belief_duration';

-- Step 6: Add comment to posts table documenting the simplified structure
COMMENT ON TABLE posts IS 'All posts must have an associated belief. No multimedia support.';
COMMENT ON COLUMN posts.belief_id IS 'Required reference to the belief market for this post';
COMMENT ON COLUMN posts.title IS 'Post title/question (required, max 200 chars)';
COMMENT ON COLUMN posts.content IS 'Post content providing context (optional, max 2000 chars)';

-- Step 7: Verify the foreign key constraint has the correct name after column rename
-- The foreign key should automatically update with the column rename, but let's ensure it's correct
ALTER TABLE posts
DROP CONSTRAINT IF EXISTS posts_opinion_belief_id_fkey;

ALTER TABLE posts
ADD CONSTRAINT posts_belief_id_fkey
FOREIGN KEY (belief_id)
REFERENCES beliefs(id)
ON DELETE CASCADE;

COMMIT;

-- Verification queries (these will run after the migration)
DO $$
BEGIN
    -- Check that the column was renamed successfully
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'belief_id'
    ) THEN
        RAISE EXCEPTION 'Column rename failed: belief_id not found';
    END IF;

    -- Check that media_urls was removed
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'media_urls'
    ) THEN
        RAISE EXCEPTION 'Column removal failed: media_urls still exists';
    END IF;

    -- Check that system config was updated
    IF NOT EXISTS (
        SELECT 1
        FROM system_config
        WHERE key = 'min_belief_duration'
        AND value = '10'
    ) THEN
        RAISE EXCEPTION 'System config update failed: min_belief_duration not set to 10';
    END IF;

    RAISE NOTICE 'Migration completed successfully: Posts now support beliefs only, no multimedia, 48h default duration';
END $$;