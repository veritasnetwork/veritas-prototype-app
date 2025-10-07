-- Allow empty content in posts table
-- This removes the minimum character requirement for post content

ALTER TABLE posts
DROP CONSTRAINT IF EXISTS posts_content_check;

ALTER TABLE posts
ADD CONSTRAINT posts_content_check
CHECK (char_length(content) <= 2000);