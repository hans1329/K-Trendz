-- Fix: Supabase Storage 요청 컨텍스트에서 auth.uid()가 비어있는 케이스 대비 (auth.jwt() fallback)
-- brand_assets 버킷: 업로드/수정/삭제는 admin만 허용

DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete brand assets" ON storage.objects;

CREATE POLICY "Admins can upload brand assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'brand_assets'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role((auth.jwt() ->> 'sub')::uuid, 'admin'::public.app_role)
  )
);

CREATE POLICY "Admins can update brand assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'brand_assets'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role((auth.jwt() ->> 'sub')::uuid, 'admin'::public.app_role)
  )
);

CREATE POLICY "Admins can delete brand assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'brand_assets'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role((auth.jwt() ->> 'sub')::uuid, 'admin'::public.app_role)
  )
);
