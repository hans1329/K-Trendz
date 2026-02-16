
-- 유저 fingerprint 저장 테이블
CREATE TABLE public.user_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_user_fingerprints_fingerprint ON public.user_fingerprints(fingerprint);
CREATE INDEX idx_user_fingerprints_created_at ON public.user_fingerprints(created_at);
CREATE INDEX idx_user_fingerprints_user_id ON public.user_fingerprints(user_id);

-- RLS 활성화
ALTER TABLE public.user_fingerprints ENABLE ROW LEVEL SECURITY;

-- 서비스 롤만 접근 가능 (보안을 위해 클라이언트 직접 접근 차단)
CREATE POLICY "Service role only" ON public.user_fingerprints
  FOR ALL USING (false);

-- Fingerprint 중복 체크 함수 (24시간 내 동일 fingerprint로 가입 여부)
CREATE OR REPLACE FUNCTION public.check_fingerprint_limit(
  p_fingerprint TEXT,
  p_window_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_user_id UUID;
BEGIN
  -- 현재 윈도우 내 동일 fingerprint 가입 횟수 조회
  SELECT COUNT(*), MAX(user_id) INTO v_count, v_last_user_id
  FROM public.user_fingerprints
  WHERE fingerprint = p_fingerprint
    AND created_at > now() - (p_window_hours || ' hours')::INTERVAL;
  
  IF v_count > 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'message', 'Multiple account creation detected. Please use your existing account.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'count', 0
  );
END;
$$;

-- Fingerprint 저장 함수
CREATE OR REPLACE FUNCTION public.save_user_fingerprint(
  p_user_id UUID,
  p_fingerprint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_fingerprints (user_id, fingerprint)
  VALUES (p_user_id, p_fingerprint)
  ON CONFLICT DO NOTHING;
END;
$$;
