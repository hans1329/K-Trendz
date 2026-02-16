-- 스캔 상태 테이블 (마지막 스캔 블록 저장)
CREATE TABLE public.onchain_scan_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_address text NOT NULL UNIQUE,
  last_scanned_block bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 트랜잭션 캐시 테이블 (이벤트 로그 누적 저장)
CREATE TABLE public.onchain_tx_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL,
  contract_address text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb,
  block_timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tx_hash, log_index)
);

-- RLS 활성화
ALTER TABLE public.onchain_scan_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onchain_tx_cache ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구나, 쓰기는 시스템만
CREATE POLICY "Anyone can view scan state" ON public.onchain_scan_state FOR SELECT USING (true);
CREATE POLICY "System can manage scan state" ON public.onchain_scan_state FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view tx cache" ON public.onchain_tx_cache FOR SELECT USING (true);
CREATE POLICY "System can manage tx cache" ON public.onchain_tx_cache FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_onchain_tx_cache_event_type ON public.onchain_tx_cache(event_type);
CREATE INDEX idx_onchain_tx_cache_block_number ON public.onchain_tx_cache(block_number);
CREATE INDEX idx_onchain_tx_cache_contract ON public.onchain_tx_cache(contract_address);