-- Add media dimension fields to posts table
-- These will be populated on upload and used for automatic aspect ratio handling

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS media_width INTEGER,
ADD COLUMN IF NOT EXISTS media_height INTEGER,
ADD COLUMN IF NOT EXISTS aspect_ratio NUMERIC(10,4);

COMMENT ON COLUMN posts.media_width IS 'Media width in pixels (for automatic aspect ratio detection)';
COMMENT ON COLUMN posts.media_height IS 'Media height in pixels (for automatic aspect ratio detection)';
COMMENT ON COLUMN posts.aspect_ratio IS 'Pre-calculated aspect ratio (width/height) for performance';
