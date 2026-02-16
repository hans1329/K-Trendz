
-- 번역 캐시 테이블
CREATE TABLE public.translation_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_hash TEXT NOT NULL,
  target_language TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_hash, target_language)
);

-- 인덱스: 소스 해시 + 언어로 빠른 조회
CREATE INDEX idx_translation_cache_lookup ON public.translation_cache (source_hash, target_language);

-- RLS 활성화 (공개 읽기, 서비스 롤만 쓰기)
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read translations"
ON public.translation_cache
FOR SELECT
USING (true);
