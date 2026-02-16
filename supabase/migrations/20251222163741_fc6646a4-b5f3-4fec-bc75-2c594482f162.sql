-- special_votes 테이블에 온체인 트랜잭션 해시 컬럼 추가
ALTER TABLE public.special_votes 
ADD COLUMN IF NOT EXISTS tx_hash text;

-- 인덱스 추가 (트랜잭션 해시로 조회 가능하도록)
CREATE INDEX IF NOT EXISTS idx_special_votes_tx_hash ON public.special_votes(tx_hash) WHERE tx_hash IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN public.special_votes.tx_hash IS 'Base 네트워크 온체인 투표 기록 트랜잭션 해시';