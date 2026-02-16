-- point_transactions 테이블에 tx_hash 컬럼 추가
ALTER TABLE public.point_transactions
ADD COLUMN tx_hash TEXT DEFAULT NULL;

-- 인덱스 추가 (온체인 트랜잭션 집계 성능 향상)
CREATE INDEX idx_point_transactions_tx_hash ON public.point_transactions(tx_hash) WHERE tx_hash IS NOT NULL;

COMMENT ON COLUMN public.point_transactions.tx_hash IS 'On-chain transaction hash for token mints and exchanges';