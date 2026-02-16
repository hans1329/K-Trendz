-- 1. invitation_codes 테이블에 다회용 지원 컬럼 추가
ALTER TABLE public.invitation_codes 
ADD COLUMN IF NOT EXISTS max_uses integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_uses integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS wiki_entry_id uuid REFERENCES public.wiki_entries(id) ON DELETE SET NULL;

-- 2. 다회용 코드 사용 기록 테이블 생성
CREATE TABLE IF NOT EXISTS public.invitation_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_code_id uuid NOT NULL REFERENCES public.invitation_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(invitation_code_id, user_id)
);

-- 3. RLS 활성화
ALTER TABLE public.invitation_code_uses ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
CREATE POLICY "Anyone can view code uses for validation"
ON public.invitation_code_uses
FOR SELECT
USING (true);

CREATE POLICY "System can insert code uses"
ON public.invitation_code_uses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage code uses"
ON public.invitation_code_uses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. 코드 생성자가 자신의 코드 사용 기록 조회
CREATE POLICY "Creators can view their code uses"
ON public.invitation_code_uses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invitation_codes ic
    WHERE ic.id = invitation_code_uses.invitation_code_id
    AND ic.creator_id = auth.uid()
  )
);

-- 6. 기존 데이터 마이그레이션: used_by가 있는 경우 current_uses = 1로 설정
UPDATE public.invitation_codes
SET current_uses = 1
WHERE used_by IS NOT NULL;

-- 7. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_invitation_code_uses_code_id ON public.invitation_code_uses(invitation_code_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_wiki_entry_id ON public.invitation_codes(wiki_entry_id);