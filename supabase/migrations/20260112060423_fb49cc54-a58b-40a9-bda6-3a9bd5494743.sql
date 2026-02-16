
-- IP 기반 Rate Limiting 테이블 생성
CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX idx_ip_rate_limits_ip_hash ON public.ip_rate_limits(ip_hash);
CREATE INDEX idx_ip_rate_limits_action_type ON public.ip_rate_limits(action_type);
CREATE INDEX idx_ip_rate_limits_created_at ON public.ip_rate_limits(created_at);
CREATE INDEX idx_ip_rate_limits_composite ON public.ip_rate_limits(ip_hash, action_type, reference_id);

-- RLS 활성화 (서비스 역할만 접근 가능)
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- 오래된 레코드 정리 함수 (24시간 이상 된 레코드 삭제)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ip_rate_limits
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$;

-- IP 체크 및 기록 함수
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  p_ip_hash TEXT,
  p_action_type TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3,
  p_window_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_result JSONB;
BEGIN
  -- 현재 윈도우 내 시도 횟수 조회
  SELECT COUNT(*) INTO v_count
  FROM public.ip_rate_limits
  WHERE ip_hash = p_ip_hash
    AND action_type = p_action_type
    AND (p_reference_id IS NULL OR reference_id = p_reference_id)
    AND created_at > now() - (p_window_hours || ' hours')::INTERVAL;
  
  -- 제한 초과 여부 확인
  IF v_count >= p_max_attempts THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'attempts', v_count,
      'max_attempts', p_max_attempts,
      'message', 'Rate limit exceeded. Please try again later.'
    );
  ELSE
    -- 새 시도 기록
    INSERT INTO public.ip_rate_limits (ip_hash, action_type, reference_id)
    VALUES (p_ip_hash, p_action_type, p_reference_id);
    
    v_result := jsonb_build_object(
      'allowed', true,
      'attempts', v_count + 1,
      'max_attempts', p_max_attempts,
      'remaining', p_max_attempts - v_count - 1
    );
  END IF;
  
  RETURN v_result;
END;
$$;
