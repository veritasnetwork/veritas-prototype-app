-- PHASE 2: Migrate existing title+content data to new schema
-- SAFE: Preserves old columns, only populates new ones

BEGIN;

-- Step 1: Create migration function
CREATE OR REPLACE FUNCTION migrate_post_to_tiptap_json(
  p_title TEXT,
  p_content TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  content_array JSONB := '[]'::JSONB;
BEGIN
  -- Build Tiptap JSON structure

  -- Add heading from title (if exists)
  IF p_title IS NOT NULL AND LENGTH(TRIM(p_title)) > 0 THEN
    content_array := content_array || jsonb_build_object(
      'type', 'heading',
      'attrs', jsonb_build_object('level', 1),
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', TRIM(p_title))
      )
    );
  END IF;

  -- Add paragraph from content (if exists)
  IF p_content IS NOT NULL AND LENGTH(TRIM(p_content)) > 0 THEN
    content_array := content_array || jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', TRIM(p_content))
      )
    );
  END IF;

  -- Build final document structure
  result := jsonb_build_object(
    'type', 'doc',
    'content', content_array
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Log pre-migration state
DO $$
DECLARE
  total_posts INTEGER;
  posts_to_migrate INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_posts FROM posts;
  SELECT COUNT(*) INTO posts_to_migrate FROM posts WHERE post_type IS NULL;

  RAISE NOTICE 'PRE-MIGRATION: Total posts: %, Posts to migrate: %', total_posts, posts_to_migrate;
END $$;

-- Step 3: Migrate all existing posts
UPDATE posts
SET
  post_type = 'text',
  content_json = migrate_post_to_tiptap_json(title, content),
  content_text = CASE
    WHEN title IS NOT NULL AND content IS NOT NULL THEN title || E'\n\n' || content
    WHEN title IS NOT NULL THEN title
    WHEN content IS NOT NULL THEN content
    ELSE ''
  END
WHERE post_type IS NULL; -- Only migrate unmigrated posts (idempotent)

-- Step 4: Verify migration success
DO $$
DECLARE
  total_posts INTEGER;
  migrated_posts INTEGER;
  posts_with_json INTEGER;
  posts_with_text INTEGER;
  posts_missing_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_posts FROM posts;
  SELECT COUNT(*) INTO migrated_posts FROM posts WHERE post_type = 'text';
  SELECT COUNT(*) INTO posts_with_json FROM posts WHERE content_json IS NOT NULL;
  SELECT COUNT(*) INTO posts_with_text FROM posts WHERE content_text IS NOT NULL;
  SELECT COUNT(*) INTO posts_missing_data
    FROM posts
    WHERE post_type = 'text' AND (content_json IS NULL OR content_text IS NULL);

  RAISE NOTICE 'POST-MIGRATION:';
  RAISE NOTICE '  Total posts: %', total_posts;
  RAISE NOTICE '  Migrated to text: %', migrated_posts;
  RAISE NOTICE '  With content_json: %', posts_with_json;
  RAISE NOTICE '  With content_text: %', posts_with_text;
  RAISE NOTICE '  Missing data: %', posts_missing_data;

  IF total_posts != migrated_posts THEN
    RAISE EXCEPTION 'Migration incomplete: % posts not migrated', total_posts - migrated_posts;
  END IF;

  IF posts_missing_data > 0 THEN
    RAISE EXCEPTION 'Data migration failed: % posts missing content_json or content_text', posts_missing_data;
  END IF;

  RAISE NOTICE 'SUCCESS: All posts migrated successfully';
END $$;

-- Step 5: Sample verification (show a few migrated posts)
DO $$
DECLARE
  sample_post RECORD;
BEGIN
  RAISE NOTICE 'SAMPLE MIGRATED POSTS:';
  FOR sample_post IN
    SELECT id,
           LEFT(title, 40) as title_preview,
           content_json->>'type' as doc_type,
           jsonb_array_length(content_json->'content') as num_blocks,
           LEFT(content_text, 50) as text_preview
    FROM posts
    LIMIT 3
  LOOP
    RAISE NOTICE '  Post %: title=%, doc_type=%, blocks=%, text=%',
      sample_post.id,
      sample_post.title_preview,
      sample_post.doc_type,
      sample_post.num_blocks,
      sample_post.text_preview;
  END LOOP;
END $$;

-- Step 6: Clean up migration function
DROP FUNCTION IF EXISTS migrate_post_to_tiptap_json(TEXT, TEXT);

COMMIT;
