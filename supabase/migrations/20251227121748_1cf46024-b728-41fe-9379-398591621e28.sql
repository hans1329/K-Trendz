-- brand_assets 업로드 정책에서 user_roles 직접 조회(=RLS 영향) 제거하고 has_role() 사용
DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete brand assets" ON storage.objects;

CREATE POLICY "Admins can upload brand assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'brand_assets'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update brand assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'brand_assets'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete brand assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'brand_assets'
  AND public.has_role(auth.uid(), 'admin')
);