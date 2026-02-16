-- 온체인 투표 캐시 테이블 생성
CREATE TABLE public.onchain_vote_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.special_vote_events(id) ON DELETE CASCADE,
  total_votes bigint NOT NULL DEFAULT 0,
  last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

-- RLS 활성화
ALTER TABLE public.onchain_vote_cache ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (공개 데이터)
CREATE POLICY "Anyone can view onchain vote cache"
  ON public.onchain_vote_cache
  FOR SELECT
  USING (true);

-- 시스템만 upsert 가능
CREATE POLICY "System can manage onchain vote cache"
  ON public.onchain_vote_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_onchain_vote_cache_event_id ON public.onchain_vote_cache(event_id);