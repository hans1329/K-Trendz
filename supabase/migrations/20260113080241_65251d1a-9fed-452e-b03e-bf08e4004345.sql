-- challenges 테이블에 prize_pool 표시 여부 컬럼 추가
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS hide_prize_pool boolean DEFAULT false;