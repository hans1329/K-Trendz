-- 가스비 대납권(Voucher) 테이블
CREATE TABLE public.gas_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voucher_code TEXT NOT NULL UNIQUE,
  daily_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  -- 소셜 인증 정보 (Sybil 방지용)
  auth_provider TEXT NOT NULL, -- 'google', 'farcaster'
  auth_provider_id TEXT NOT NULL, -- provider별 고유 ID
  
  CONSTRAINT unique_user_voucher UNIQUE (user_id),
  CONSTRAINT unique_auth_provider UNIQUE (auth_provider, auth_provider_id)
);

-- Voucher 일일 사용량 추적
CREATE TABLE public.voucher_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.gas_vouchers(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_volume_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  gas_sponsored_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_voucher_date UNIQUE (voucher_id, usage_date)
);

-- RLS 활성화
ALTER TABLE public.gas_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_daily_usage ENABLE ROW LEVEL SECURITY;

-- 유저는 자신의 Voucher만 조회 가능
CREATE POLICY "Users can view own voucher"
  ON public.gas_vouchers FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할만 Voucher 생성/수정 가능 (Edge Function에서)
CREATE POLICY "Service can manage vouchers"
  ON public.gas_vouchers FOR ALL
  USING (auth.role() = 'service_role');

-- 일일 사용량은 서비스 역할만 접근
CREATE POLICY "Service can manage voucher usage"
  ON public.voucher_daily_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Voucher 코드 생성 함수
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'KTV-'; -- K-Trendz Voucher prefix
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Voucher 일일 한도 체크 함수
CREATE OR REPLACE FUNCTION check_voucher_daily_limit(
  _voucher_code TEXT,
  _amount_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  voucher_record RECORD;
  usage_record RECORD;
  remaining NUMERIC;
BEGIN
  -- Voucher 조회
  SELECT * INTO voucher_record
  FROM gas_vouchers
  WHERE voucher_code = _voucher_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired voucher');
  END IF;
  
  -- 오늘 사용량 조회
  SELECT * INTO usage_record
  FROM voucher_daily_usage
  WHERE voucher_id = voucher_record.id
    AND usage_date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    remaining := voucher_record.daily_limit_usd;
  ELSE
    remaining := voucher_record.daily_limit_usd - usage_record.total_volume_usd;
  END IF;
  
  IF remaining < _amount_usd THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily limit exceeded',
      'remaining_usd', remaining
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', voucher_record.id,
    'user_id', voucher_record.user_id,
    'remaining_usd', remaining - _amount_usd
  );
END;
$$;

-- Voucher 사용량 증가 함수
CREATE OR REPLACE FUNCTION increment_voucher_usage(
  _voucher_id UUID,
  _amount_usd NUMERIC,
  _gas_usd NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO voucher_daily_usage (voucher_id, usage_date, total_volume_usd, transaction_count, gas_sponsored_usd)
  VALUES (_voucher_id, CURRENT_DATE, _amount_usd, 1, _gas_usd)
  ON CONFLICT (voucher_id, usage_date)
  DO UPDATE SET
    total_volume_usd = voucher_daily_usage.total_volume_usd + _amount_usd,
    transaction_count = voucher_daily_usage.transaction_count + 1,
    gas_sponsored_usd = voucher_daily_usage.gas_sponsored_usd + _gas_usd,
    updated_at = now();
  
  UPDATE gas_vouchers SET last_used_at = now() WHERE id = _voucher_id;
END;
$$;

-- 인덱스
CREATE INDEX idx_gas_vouchers_code ON public.gas_vouchers(voucher_code);
CREATE INDEX idx_gas_vouchers_user ON public.gas_vouchers(user_id);
CREATE INDEX idx_voucher_usage_date ON public.voucher_daily_usage(voucher_id, usage_date);