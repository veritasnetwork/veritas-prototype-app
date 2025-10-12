-- Phase 6: Remove old schema columns (title, content)
-- Since we're in dev environment, we can drop these columns completely

BEGIN;

-- Drop old schema columns
ALTER TABLE posts
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS content;

-- Verify columns are removed
DO $$
DECLARE
  title_exists BOOLEAN;
  content_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'title'
  ) INTO title_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'content'
  ) INTO content_exists;

  IF title_exists OR content_exists THEN
    RAISE EXCEPTION 'Migration failed: Old columns still exist';
  END IF;

  RAISE NOTICE 'SUCCESS: Old schema columns (title, content) removed';
END $$;

COMMIT;
