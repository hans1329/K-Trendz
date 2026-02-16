-- 가스비 전송 기록 테이블
CREATE TABLE public.withdrawal_gas_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  eth_amount NUMERIC NOT NULL DEFAULT 0.0001,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.withdrawal_gas_transfers ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 기록만 조회 가능
CREATE POLICY "Users can view their own gas transfers"
ON public.withdrawal_gas_transfers
FOR SELECT
USING (auth.uid() = user_id);

-- 시스템만 삽입 가능
CREATE POLICY "System can insert gas transfers"
ON public.withdrawal_gas_transfers
FOR INSERT
WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_withdrawal_gas_transfers_user_id ON public.withdrawal_gas_transfers(user_id);
CREATE INDEX idx_withdrawal_gas_transfers_created_at ON public.withdrawal_gas_transfers(created_at DESC);