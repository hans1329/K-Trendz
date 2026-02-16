-- support_proposal_opinions 테이블에 tx_hash 컬럼 추가
ALTER TABLE public.support_proposal_opinions 
ADD COLUMN IF NOT EXISTS tx_hash TEXT;