-- Add image_display_mode column to posts table
-- Allows users to choose between 'contain' (full image with letterbox) or 'cover' (cropped to fill)

ALTER TABLE posts
ADD COLUMN image_display_mode TEXT DEFAULT 'contain' CHECK (image_display_mode IN ('contain', 'cover'));

COMMENT ON COLUMN posts.image_display_mode IS 'How to display image posts: contain (full image with letterbox) or cover (cropped to fill card)';
