-- challenge_participations에 claimed_at 컬럼 추가
ALTER TABLE public.challenge_participations
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_challenge_participations_claimed_at ON public.challenge_participations(claimed_at);

COMMENT ON COLUMN public.challenge_participations.claimed_at IS '상금 클레임 시간';