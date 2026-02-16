-- Create wiki-images bucket for storing wiki entry images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wiki-images',
  'wiki-images',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
);

-- Create RLS policies for wiki-images bucket
CREATE POLICY "Wiki images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'wiki-images');

CREATE POLICY "Authenticated users can upload wiki images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'wiki-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update wiki images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'wiki-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete wiki images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'wiki-images' 
  AND auth.role() = 'authenticated'
);