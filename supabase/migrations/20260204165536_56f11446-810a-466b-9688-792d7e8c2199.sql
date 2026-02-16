-- OpenClaw Bot Agents 테이블
-- API Key 인증 및 일일 한도 관리
CREATE TABLE public.bot_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  wallet_address TEXT,
  daily_limit_usd NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API Key 해시 인덱스 (빠른 조회)
CREATE INDEX idx_bot_agents_api_key_hash ON public.bot_agents(api_key_hash);

-- Bot 거래 기록 테이블
CREATE TABLE public.bot_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.bot_agents(id),
  fanz_token_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  amount INTEGER NOT NULL DEFAULT 1,
  price_usdc NUMERIC NOT NULL,
  total_cost_usdc NUMERIC NOT NULL,
  fee_usdc NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 에이전트별 일일 거래량 조회를 위한 인덱스
CREATE INDEX idx_bot_transactions_agent_date ON public.bot_transactions(agent_id, created_at);
CREATE INDEX idx_bot_transactions_status ON public.bot_transactions(status);

-- 일일 거래량 계산 함수
CREATE OR REPLACE FUNCTION public.get_bot_agent_daily_usage(agent_id_param UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(total_cost_usdc), 0)
  FROM public.bot_transactions
  WHERE agent_id = agent_id_param
    AND status = 'completed'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
$$;

-- API Key로 에이전트 조회 함수 (해시 비교)
CREATE OR REPLACE FUNCTION public.get_bot_agent_by_api_key(api_key_param TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  wallet_address TEXT,
  daily_limit_usd NUMERIC,
  daily_usage NUMERIC,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  key_hash TEXT;
BEGIN
  key_hash := encode(sha256(api_key_param::bytea), 'hex');
  
  RETURN QUERY
  SELECT 
    ba.id,
    ba.name,
    ba.wallet_address,
    ba.daily_limit_usd,
    public.get_bot_agent_daily_usage(ba.id) as daily_usage,
    ba.is_active
  FROM public.bot_agents ba
  WHERE ba.api_key_hash = key_hash
    AND ba.is_active = true;
END;
$$;

-- RLS 활성화
ALTER TABLE public.bot_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_transactions ENABLE ROW LEVEL SECURITY;

-- Admin만 에이전트 관리 가능
CREATE POLICY "Admins can manage bot agents"
ON public.bot_agents
FOR ALL
USING (public.is_admin(auth.uid()));

-- Admin만 거래 기록 조회 가능
CREATE POLICY "Admins can view bot transactions"
ON public.bot_transactions
FOR SELECT
USING (public.is_admin(auth.uid()));

-- 서비스 역할은 모든 작업 가능 (Edge Function용)
-- Note: service_role은 RLS를 우회하므로 별도 정책 불필요

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_bot_agents_updated_at
  BEFORE UPDATE ON public.bot_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.bot_agents IS 'OpenClaw 등 외부 봇 에이전트 관리 테이블';
COMMENT ON TABLE public.bot_transactions IS '봇 에이전트의 Fanz Token 거래 기록';
COMMENT ON COLUMN public.bot_agents.api_key IS '실제 API Key (발급 시 한 번만 노출)';
COMMENT ON COLUMN public.bot_agents.api_key_hash IS 'API Key의 SHA256 해시 (인증용)';