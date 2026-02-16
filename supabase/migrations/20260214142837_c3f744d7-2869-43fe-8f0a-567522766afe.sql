
-- 인증된 사용자가 자신의 폴더에 업로드 가능
CREATE POLICY "Users can upload agent avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 인증된 사용자가 자신의 파일 업데이트 가능
CREATE POLICY "Users can update agent avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 인증된 사용자가 자신의 파일 삭제 가능
CREATE POLICY "Users can delete agent avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
