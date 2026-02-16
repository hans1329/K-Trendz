
-- Fingerprint 중복 체크 함수 수정 (MAX(uuid) 제거)
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
BEGIN
  -- 현재 윈도우 내 동일 fingerprint 가입 횟수 조회
  SELECT COUNT(*) INTO v_count
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
