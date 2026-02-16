-- 챌린지 승인 및 클레임 관련 컬럼 추가
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS claim_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS claim_end_time TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_challenges_claim_start_time ON public.challenges(claim_start_time);
CREATE INDEX IF NOT EXISTS idx_challenges_admin_approved_at ON public.challenges(admin_approved_at);

-- 코멘트 추가
COMMENT ON COLUMN public.challenges.admin_approved_at IS '관리자 승인 시간';
COMMENT ON COLUMN public.challenges.admin_approved_by IS '승인한 관리자 ID';
COMMENT ON COLUMN public.challenges.claim_start_time IS '상금 클레임 가능 시작 시간';
COMMENT ON COLUMN public.challenges.claim_end_time IS '상금 클레임 마감 시간';