-- challenges 테이블에 참여 비용(스타 포인트) 컬럼 추가
ALTER TABLE public.challenges 
ADD COLUMN entry_cost integer NOT NULL DEFAULT 0;

-- 코멘트 추가
COMMENT ON COLUMN public.challenges.entry_cost IS 'Star points cost to participate in the challenge';