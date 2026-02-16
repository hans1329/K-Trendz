-- 온체인 nonce 관리 테이블 (concurrent 요청 시 nonce 충돌 방지)
CREATE TABLE public.onchain_nonces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_address TEXT NOT NULL UNIQUE,
  current_nonce BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화 (서비스 역할만 접근)
ALTER TABLE public.onchain_nonces ENABLE ROW LEVEL SECURITY;

-- 서비스 역할용 정책
CREATE POLICY "Service role can manage nonces"
ON public.onchain_nonces
FOR ALL
USING (true)
WITH CHECK (true);

-- Atomic nonce increment 함수
CREATE OR REPLACE FUNCTION public.get_next_nonce(p_sender_address TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nonce BIGINT;
BEGIN
  -- UPSERT: 없으면 생성, 있으면 increment
  INSERT INTO onchain_nonces (sender_address, current_nonce, last_used_at)
  VALUES (p_sender_address, 0, now())
  ON CONFLICT (sender_address)
  DO UPDATE SET 
    current_nonce = onchain_nonces.current_nonce + 1,
    last_used_at = now()
  RETURNING current_nonce INTO v_nonce;
  
  RETURN v_nonce;
END;
$$;

-- Backend Smart Account 초기화 (현재 nonce 374 이후부터 시작)
INSERT INTO public.onchain_nonces (sender_address, current_nonce)
VALUES ('0x8B4197d938b8F4212B067e9925F7251B6C21B856', 380)
ON CONFLICT (sender_address) DO NOTHING;