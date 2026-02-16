-- challenge_participations 테이블에 tx_hash 컬럼 추가
ALTER TABLE public.challenge_participations 
ADD COLUMN IF NOT EXISTS tx_hash text;

-- tx_hash 컬럼에 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_challenge_participations_tx_hash 
ON public.challenge_participations(tx_hash) 
WHERE tx_hash IS NOT NULL;