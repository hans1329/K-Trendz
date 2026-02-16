-- challenges 테이블에 블록체인 검증 정보 컬럼 추가
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS selection_block_number bigint,
ADD COLUMN IF NOT EXISTS selection_block_hash text,
ADD COLUMN IF NOT EXISTS selection_tx_hash text,
ADD COLUMN IF NOT EXISTS selection_seed text,
ADD COLUMN IF NOT EXISTS selected_at timestamp with time zone;