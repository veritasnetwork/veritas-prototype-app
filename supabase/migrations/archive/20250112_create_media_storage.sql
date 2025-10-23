-- Phase 4: Create Supabase Storage bucket for media uploads
-- This migration creates a public bucket for images and videos with RLS policies

BEGIN;

-- Create the storage bucket for media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'veritas-media',
  'veritas-media',
  true,  -- Public bucket (files accessible via public URL)
  104857600,  -- 100MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Public media files are viewable by anyone" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;

-- RLS Policy 1: Anyone can view media files (public bucket)
-- Note: Public bucket already allows viewing, but we'll add explicit policy for clarity
CREATE POLICY "Public media files are viewable by anyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'veritas-media');

-- RLS Policy 2: Authenticated users can upload media files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'veritas-media' AND
  -- Enforce folder structure: images/{user_id}/* or videos/{user_id}/*
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

-- RLS Policy 3: Users can update their own media files
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

-- RLS Policy 4: Users can delete their own media files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

-- Verify migration success
DO $$
DECLARE
  bucket_exists BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if bucket was created
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'veritas-media'
  ) INTO bucket_exists;

  IF NOT bucket_exists THEN
    RAISE EXCEPTION 'Migration failed: veritas-media bucket not created';
  END IF;

  -- Check if policies were created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'Public media files are viewable by anyone',
      'Authenticated users can upload media',
      'Users can update their own media',
      'Users can delete their own media'
    );

  IF policy_count != 4 THEN
    RAISE EXCEPTION 'Migration failed: Only % of 4 RLS policies created', policy_count;
  END IF;

  RAISE NOTICE 'SUCCESS: veritas-media bucket created with % RLS policies', policy_count;
END $$;

COMMIT;
