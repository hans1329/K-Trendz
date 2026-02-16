-- wallet_addresses 테이블에 wallet_type 컬럼 추가
ALTER TABLE public.wallet_addresses 
ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'eoa';

-- 기존 지갑은 모두 EOA로 설정
UPDATE public.wallet_addresses SET wallet_type = 'eoa' WHERE wallet_type IS NULL;