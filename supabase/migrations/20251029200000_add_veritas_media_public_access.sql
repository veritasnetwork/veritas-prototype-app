-- Allow public read access to veritas-media bucket
-- This enables uploaded images to be loaded without authentication

-- Allow anyone to read objects from veritas-media bucket
CREATE POLICY "Public read access for veritas-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'veritas-media');

-- Allow authenticated users to insert objects to veritas-media bucket
CREATE POLICY "Authenticated users can upload to veritas-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'veritas-media' AND auth.role() = 'authenticated');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own uploads in veritas-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'veritas-media' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads in veritas-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'veritas-media' AND auth.role() = 'authenticated');
