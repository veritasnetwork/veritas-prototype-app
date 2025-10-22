-- Add article_title and cover_image_url for enhanced article posts
-- These fields support featured article display with dedicated titles and hero images

BEGIN;

-- Add new columns (both nullable for backward compatibility)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS article_title TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add constraints
ALTER TABLE posts
  ADD CONSTRAINT posts_article_title_length
  CHECK (article_title IS NULL OR char_length(article_title) BETWEEN 1 AND 200);

-- Add business rule: cover_image_url requires article_title
ALTER TABLE posts
  ADD CONSTRAINT posts_cover_requires_title
  CHECK (cover_image_url IS NULL OR article_title IS NOT NULL);

-- Add comments for documentation
COMMENT ON COLUMN posts.article_title IS 'Optional dedicated title for text/article posts. Displayed prominently on post cards.';
COMMENT ON COLUMN posts.cover_image_url IS 'Optional cover/hero image URL for text/article posts. Requires article_title to be set.';

-- Add index for full-text search on article titles
CREATE INDEX IF NOT EXISTS idx_posts_article_title_search
  ON posts USING gin(to_tsvector('english', COALESCE(article_title, '')));

-- Verify migration success
DO $$
DECLARE
  col_count INTEGER;
  constraint_count INTEGER;
BEGIN
  -- Check columns added
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'posts'
    AND column_name IN ('article_title', 'cover_image_url');

  IF col_count != 2 THEN
    RAISE EXCEPTION 'Migration failed: Only % of 2 columns added', col_count;
  END IF;

  -- Check constraints added
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'posts'
    AND constraint_name IN ('posts_article_title_length', 'posts_cover_requires_title');

  IF constraint_count != 2 THEN
    RAISE EXCEPTION 'Migration failed: Only % of 2 constraints added', constraint_count;
  END IF;

  RAISE NOTICE 'SUCCESS: Article title and cover image columns added to posts table';
END $$;

COMMIT;
