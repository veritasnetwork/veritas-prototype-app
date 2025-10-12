-- PHASE 1: Add new columns for rich media support
-- SAFE: Purely additive, does NOT remove or modify existing columns

BEGIN;

-- Add new columns (all nullable to avoid breaking existing INSERTs)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type TEXT,
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS media_urls TEXT[],
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Add column comments for documentation
COMMENT ON COLUMN posts.post_type IS 'Content type: text, image, or video. Added in Phase 1 for rich media support.';
COMMENT ON COLUMN posts.content_json IS 'Tiptap JSON for rich text posts. Added in Phase 1.';
COMMENT ON COLUMN posts.media_urls IS 'Array of media URLs for image/video posts. Added in Phase 1.';
COMMENT ON COLUMN posts.caption IS 'Optional caption for all post types (max 280 chars). Added in Phase 1.';
COMMENT ON COLUMN posts.content_text IS 'Plain text extracted from content_json or caption for search. Added in Phase 1.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_posts_content_text_search
  ON posts USING gin(to_tsvector('english', COALESCE(content_text, '')));

-- Add caption length constraint (safe because column is nullable)
ALTER TABLE posts
  ADD CONSTRAINT posts_caption_length_check
  CHECK (caption IS NULL OR char_length(caption) <= 280);

-- Verify migration success
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'posts'
    AND column_name IN ('post_type', 'content_json', 'media_urls', 'caption', 'content_text');

  IF col_count != 5 THEN
    RAISE EXCEPTION 'Migration failed: Only % of 5 columns added', col_count;
  END IF;

  RAISE NOTICE 'SUCCESS: All 5 new columns added to posts table';
END $$;

COMMIT;