-- Create storage bucket for community assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-assets', 'community-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for community assets
CREATE POLICY "Community assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-assets');

CREATE POLICY "Authenticated users can upload community assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community-assets' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own community assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'community-assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own community assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'community-assets'
  AND auth.role() = 'authenticated'
);