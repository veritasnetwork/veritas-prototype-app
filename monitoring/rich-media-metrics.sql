-- Phase 11: Rich Media Monitoring Queries
-- Run these queries to validate the rich media implementation

-- ============================================
-- 1. POST CREATION METRICS
-- ============================================

-- Daily post creation by type (last 7 days)
SELECT
  post_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM posts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY post_type, DATE(created_at)
ORDER BY date DESC, post_type;

-- Total posts by type (all time)
SELECT
  post_type,
  COUNT(*) as total_posts,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM posts
GROUP BY post_type
ORDER BY total_posts DESC;

-- ============================================
-- 2. SCHEMA USAGE ANALYSIS
-- ============================================

-- Old vs New schema usage
SELECT
  CASE
    WHEN post_type IS NOT NULL THEN 'new_schema'
    WHEN title IS NOT NULL OR content IS NOT NULL THEN 'old_schema'
    ELSE 'unknown'
  END as schema_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM posts
GROUP BY schema_type
ORDER BY count DESC;

-- Posts with complete new schema data
SELECT
  post_type,
  COUNT(*) as total,
  COUNT(CASE WHEN post_type = 'text' AND content_json IS NOT NULL THEN 1 END) as text_with_json,
  COUNT(CASE WHEN post_type IN ('image', 'video') AND media_urls IS NOT NULL THEN 1 END) as media_with_urls,
  COUNT(content_text) as with_extracted_text
FROM posts
WHERE post_type IS NOT NULL
GROUP BY post_type;

-- ============================================
-- 3. MEDIA UPLOAD SUCCESS
-- ============================================

-- Posts with media URLs (image/video posts)
SELECT
  post_type,
  COUNT(*) as total,
  COUNT(media_urls) as with_media,
  ROUND(100.0 * COUNT(media_urls) / NULLIF(COUNT(*), 0), 2) as media_percentage,
  COUNT(caption) as with_caption,
  ROUND(100.0 * COUNT(caption) / NULLIF(COUNT(*), 0), 2) as caption_percentage
FROM posts
WHERE post_type IN ('image', 'video')
GROUP BY post_type;

-- Media URL array lengths (how many URLs per post)
SELECT
  post_type,
  array_length(media_urls, 1) as url_count,
  COUNT(*) as posts
FROM posts
WHERE post_type IN ('image', 'video') AND media_urls IS NOT NULL
GROUP BY post_type, array_length(media_urls, 1)
ORDER BY post_type, url_count;

-- ============================================
-- 4. CONTENT ANALYSIS
-- ============================================

-- Rich text posts - content_json structure validation
SELECT
  COUNT(*) as total_text_posts,
  COUNT(content_json) as with_content_json,
  COUNT(content_text) as with_extracted_text,
  AVG(LENGTH(content_text::TEXT)) as avg_content_length
FROM posts
WHERE post_type = 'text';

-- Caption length distribution
SELECT
  post_type,
  COUNT(*) as posts_with_caption,
  MIN(LENGTH(caption)) as min_caption_length,
  MAX(LENGTH(caption)) as max_caption_length,
  ROUND(AVG(LENGTH(caption))) as avg_caption_length
FROM posts
WHERE caption IS NOT NULL
GROUP BY post_type;

-- ============================================
-- 5. DATA INTEGRITY CHECKS
-- ============================================

-- Posts missing required fields
SELECT
  'text posts without content_json' as issue,
  COUNT(*) as count
FROM posts
WHERE post_type = 'text' AND content_json IS NULL

UNION ALL

SELECT
  'image posts without media_urls' as issue,
  COUNT(*) as count
FROM posts
WHERE post_type = 'image' AND media_urls IS NULL

UNION ALL

SELECT
  'video posts without media_urls' as issue,
  COUNT(*) as count
FROM posts
WHERE post_type = 'video' AND media_urls IS NULL

UNION ALL

SELECT
  'posts without post_type' as issue,
  COUNT(*) as count
FROM posts
WHERE post_type IS NULL;

-- ============================================
-- 6. RECENT ACTIVITY
-- ============================================

-- Last 10 posts created (all types)
SELECT
  id,
  post_type,
  CASE
    WHEN post_type = 'text' THEN LEFT(content_text, 50)
    WHEN post_type IN ('image', 'video') THEN LEFT(caption, 50)
    ELSE NULL
  END as preview,
  created_at,
  author_id
FROM posts
ORDER BY created_at DESC
LIMIT 10;

-- Posts created in last 24 hours by type
SELECT
  post_type,
  COUNT(*) as count
FROM posts
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY post_type;

-- ============================================
-- 7. STORAGE USAGE (if applicable)
-- ============================================

-- Count media files by post
SELECT
  post_type,
  COUNT(*) as posts_with_media,
  SUM(array_length(media_urls, 1)) as total_media_files
FROM posts
WHERE media_urls IS NOT NULL
GROUP BY post_type;
