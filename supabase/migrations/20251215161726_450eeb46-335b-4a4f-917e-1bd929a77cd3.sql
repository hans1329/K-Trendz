-- withdrawal_requests 테이블에 fee_tx_hash 컬럼 추가
ALTER TABLE IF EXISTS public.withdrawal_requests 
ADD COLUMN IF NOT EXISTS fee_tx_hash TEXT;