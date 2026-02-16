-- ============================================
-- OpenClaw Direct Contract: Verified Agents
-- 소셜 인증 기반 에이전트 관리 시스템
-- ============================================

-- 에이전트 상태 enum
CREATE TYPE public.agent_status AS ENUM ('pending', 'verified', 'suspended');

-- 소셜 인증된 에이전트 테이블
CREATE TABLE public.verified_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Smart Wallet 정보
    wallet_address TEXT NOT NULL UNIQUE,
    
    -- 소셜 인증 정보
    social_provider TEXT NOT NULL CHECK (social_provider IN ('twitter', 'discord')),
    social_id TEXT NOT NULL,
    social_username TEXT,
    social_avatar_url TEXT,
    
    -- 상태 관리
    status agent_status NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    
    -- Rate Limit
    daily_limit_usd NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    daily_tx_limit INTEGER NOT NULL DEFAULT 50,
    
    -- Paymaster 승인
    paymaster_approved BOOLEAN NOT NULL DEFAULT false,
    
    -- 메타데이터
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- 소셜 계정 중복 방지
    UNIQUE (social_provider, social_id)
);

-- 에이전트 일일 사용량 추적
CREATE TABLE public.agent_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.verified_agents(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- 거래 통계
    transaction_count INTEGER NOT NULL DEFAULT 0,
    buy_count INTEGER NOT NULL DEFAULT 0,
    sell_count INTEGER NOT NULL DEFAULT 0,
    
    -- 금액 통계
    total_volume_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_fees_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (agent_id, usage_date)
);

-- 에이전트 온체인 트랜잭션 기록
CREATE TABLE public.agent_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.verified_agents(id) ON DELETE CASCADE,
    
    -- 트랜잭션 정보
    tx_hash TEXT NOT NULL UNIQUE,
    tx_type TEXT NOT NULL CHECK (tx_type IN ('buy', 'sell')),
    
    -- 토큰 정보
    fanz_token_id UUID REFERENCES public.fanz_tokens(id),
    token_amount INTEGER NOT NULL DEFAULT 1,
    
    -- 금액 정보 (USDC, 6 decimals)
    price_usdc NUMERIC(12, 6) NOT NULL,
    fee_usdc NUMERIC(10, 6) NOT NULL DEFAULT 0,
    total_usdc NUMERIC(12, 6) NOT NULL,
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    block_number BIGINT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_verified_agents_wallet ON public.verified_agents(wallet_address);
CREATE INDEX idx_verified_agents_social ON public.verified_agents(social_provider, social_id);
CREATE INDEX idx_verified_agents_status ON public.verified_agents(status);
CREATE INDEX idx_agent_daily_usage_date ON public.agent_daily_usage(agent_id, usage_date);
CREATE INDEX idx_agent_transactions_agent ON public.agent_transactions(agent_id, created_at DESC);
CREATE INDEX idx_agent_transactions_hash ON public.agent_transactions(tx_hash);

-- RLS 활성화
ALTER TABLE public.verified_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: verified_agents (공개 조회, 서비스만 수정)
CREATE POLICY "Anyone can view verified agents"
    ON public.verified_agents FOR SELECT
    USING (status = 'verified');

-- RLS 정책: agent_daily_usage (서비스만 접근)
CREATE POLICY "Service role only for daily usage"
    ON public.agent_daily_usage FOR ALL
    USING (false);

-- RLS 정책: agent_transactions (공개 조회)
CREATE POLICY "Anyone can view agent transactions"
    ON public.agent_transactions FOR SELECT
    USING (true);

-- 일일 사용량 체크 함수
CREATE OR REPLACE FUNCTION public.check_agent_daily_limit(
    _agent_id UUID,
    _amount_usd NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _daily_limit NUMERIC;
    _current_usage NUMERIC;
BEGIN
    -- 에이전트 일일 한도 조회
    SELECT daily_limit_usd INTO _daily_limit
    FROM public.verified_agents
    WHERE id = _agent_id AND status = 'verified';
    
    IF _daily_limit IS NULL THEN
        RETURN false;
    END IF;
    
    -- 오늘 사용량 조회
    SELECT COALESCE(total_volume_usd, 0) INTO _current_usage
    FROM public.agent_daily_usage
    WHERE agent_id = _agent_id AND usage_date = CURRENT_DATE;
    
    -- 한도 체크
    RETURN (_current_usage + _amount_usd) <= _daily_limit;
END;
$$;

-- 일일 사용량 증가 함수
CREATE OR REPLACE FUNCTION public.increment_agent_usage(
    _agent_id UUID,
    _tx_type TEXT,
    _amount_usd NUMERIC,
    _fee_usd NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.agent_daily_usage (agent_id, usage_date, transaction_count, buy_count, sell_count, total_volume_usd, total_fees_usd)
    VALUES (
        _agent_id,
        CURRENT_DATE,
        1,
        CASE WHEN _tx_type = 'buy' THEN 1 ELSE 0 END,
        CASE WHEN _tx_type = 'sell' THEN 1 ELSE 0 END,
        _amount_usd,
        _fee_usd
    )
    ON CONFLICT (agent_id, usage_date)
    DO UPDATE SET
        transaction_count = agent_daily_usage.transaction_count + 1,
        buy_count = agent_daily_usage.buy_count + CASE WHEN _tx_type = 'buy' THEN 1 ELSE 0 END,
        sell_count = agent_daily_usage.sell_count + CASE WHEN _tx_type = 'sell' THEN 1 ELSE 0 END,
        total_volume_usd = agent_daily_usage.total_volume_usd + _amount_usd,
        total_fees_usd = agent_daily_usage.total_fees_usd + _fee_usd,
        updated_at = now();
END;
$$;

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_verified_agents_updated_at
    BEFORE UPDATE ON public.verified_agents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();