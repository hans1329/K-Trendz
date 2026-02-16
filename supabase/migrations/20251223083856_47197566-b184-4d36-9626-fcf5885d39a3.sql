-- challenges 테이블에 이미지 URL 컬럼 추가
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS image_url text;

-- 챌린지 이미지 저장용 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-images', 'challenge-images', true)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 RLS 정책: 누구나 이미지 조회 가능
CREATE POLICY "Challenge images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'challenge-images');

-- 스토리지 RLS 정책: 관리자만 이미지 업로드 가능
CREATE POLICY "Admins can upload challenge images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'challenge-images' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 스토리지 RLS 정책: 관리자만 이미지 삭제 가능
CREATE POLICY "Admins can delete challenge images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'challenge-images' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);