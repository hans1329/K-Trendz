-- USDC 잔액 테이블
CREATE TABLE public.usdc_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- USDC 트랜잭션 테이블
CREATE TABLE public.usdc_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(20, 6) NOT NULL,
  fee NUMERIC(20, 6) NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL, -- 'prize_claim', 'withdrawal', 'deposit'
  reference_id TEXT, -- challenge_id, tx_hash 등
  tx_hash TEXT, -- 온체인 출금시 트랜잭션 해시
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.usdc_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdc_transactions ENABLE ROW LEVEL SECURITY;

-- usdc_balances RLS 정책
CREATE POLICY "Users can view their own USDC balance"
  ON public.usdc_balances FOR SELECT
  USING (auth.uid() = user_id);

-- usdc_transactions RLS 정책
CREATE POLICY "Users can view their own USDC transactions"
  ON public.usdc_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at 트리거
CREATE TRIGGER update_usdc_balances_updated_at
  BEFORE UPDATE ON public.usdc_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 인덱스
CREATE INDEX idx_usdc_balances_user_id ON public.usdc_balances(user_id);
CREATE INDEX idx_usdc_transactions_user_id ON public.usdc_transactions(user_id);
CREATE INDEX idx_usdc_transactions_created_at ON public.usdc_transactions(created_at DESC);