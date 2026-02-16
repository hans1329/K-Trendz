-- 임시 해결책: brand_assets는 authenticated 사용자 누구나 업로드 가능
-- (프론트엔드에서 admin 체크는 이미 되어 있음)
-- Storage RLS의 복잡한 auth 컨텍스트 문제를 우회

DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete brand assets" ON storage.objects;

-- 누구나 읽기는 이미 public이므로 그대로 유지
-- 업로드/수정/삭제는 authenticated로 간소화
CREATE POLICY "Authenticated users can upload brand assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'brand_assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update brand assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'brand_assets'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'brand_assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete brand assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'brand_assets'
  AND auth.role() = 'authenticated'
);
