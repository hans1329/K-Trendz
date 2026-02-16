-- YouTube 챌린지에서 정답을 가져올 시점을 저장할 컬럼 추가
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS answer_fetch_time TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가 (정답 fetch 대상 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_challenges_answer_fetch_time 
ON public.challenges (answer_fetch_time) 
WHERE answer_fetch_time IS NOT NULL AND correct_answer = '';

COMMENT ON COLUMN public.challenges.answer_fetch_time IS 'YouTube 챌린지에서 정답 데이터를 가져올 시점';