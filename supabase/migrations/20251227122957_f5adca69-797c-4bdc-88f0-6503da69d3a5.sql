-- Fix: Storage upsert(INSERT .. ON CONFLICT DO UPDATE)에서 UPDATE의 WITH CHECK 누락 + auth 컨텍스트 보강
-- bucket: brand_assets (admin only)

DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete brand assets" ON storage.objects;

-- 공통: 요청에서 user id 추출 (auth.uid()가 null인 컨텍스트 대비)
-- coalesce 순서: auth.uid() -> request.jwt.claim.sub -> auth.jwt().sub

CREATE POLICY "Admins can upload brand assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'brand_assets'
  AND public.has_role(
    COALESCE(
      auth.uid(),
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    ),
    'admin'::public.app_role
  )
);

CREATE POLICY "Admins can update brand assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'brand_assets'
  AND public.has_role(
    COALESCE(
      auth.uid(),
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    ),
    'admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'brand_assets'
  AND public.has_role(
    COALESCE(
      auth.uid(),
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    ),
    'admin'::public.app_role
  )
);

CREATE POLICY "Admins can delete brand assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'brand_assets'
  AND public.has_role(
    COALESCE(
      auth.uid(),
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    ),
    'admin'::public.app_role
  )
);
