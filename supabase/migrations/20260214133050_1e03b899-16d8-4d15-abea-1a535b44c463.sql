-- agent_personas 테이블에 아바타 이미지 URL 컬럼 추가
ALTER TABLE public.agent_personas ADD COLUMN IF NOT EXISTS avatar_url text;

-- 에이전트 아바타 이미지용 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-avatars', 'agent-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 누구나 에이전트 아바타를 볼 수 있음
CREATE POLICY "Agent avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-avatars');

-- 관리자만 업로드/수정/삭제 가능
CREATE POLICY "Admins can upload agent avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can update agent avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-avatars'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete agent avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-avatars'
  AND public.is_admin(auth.uid())
);