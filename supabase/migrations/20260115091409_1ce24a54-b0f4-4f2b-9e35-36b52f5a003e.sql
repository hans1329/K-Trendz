-- post_votes에 온체인 트랜잭션 해시 저장 컬럼 추가
ALTER TABLE public.post_votes
ADD COLUMN IF NOT EXISTS tx_hash TEXT;