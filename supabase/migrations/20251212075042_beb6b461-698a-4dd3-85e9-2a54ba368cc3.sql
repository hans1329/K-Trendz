-- 엔트리별 커뮤니티 펀드 테이블 생성
CREATE TABLE public.entry_community_funds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  total_fund NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_wiki_entry_fund UNIQUE (wiki_entry_id)
);

-- 펀드 트랜잭션 히스토리 테이블 생성
CREATE TABLE public.entry_fund_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL, -- 'deposit' (구매시 적립), 'withdraw' (사용)
  fanz_transaction_id UUID REFERENCES public.fanz_transactions(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.entry_community_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_fund_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 누구나 펀드 잔액 조회 가능
CREATE POLICY "Anyone can view community funds"
ON public.entry_community_funds
FOR SELECT
USING (true);

-- RLS 정책: 시스템만 펀드 삽입/수정 가능
CREATE POLICY "System can manage community funds"
ON public.entry_community_funds
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS 정책: 누구나 펀드 트랜잭션 조회 가능
CREATE POLICY "Anyone can view fund transactions"
ON public.entry_fund_transactions
FOR SELECT
USING (true);

-- RLS 정책: 시스템만 트랜잭션 삽입 가능
CREATE POLICY "System can insert fund transactions"
ON public.entry_fund_transactions
FOR INSERT
WITH CHECK (true);

-- 인덱스 생성
CREATE INDEX idx_entry_community_funds_wiki_entry_id ON public.entry_community_funds(wiki_entry_id);
CREATE INDEX idx_entry_fund_transactions_wiki_entry_id ON public.entry_fund_transactions(wiki_entry_id);
CREATE INDEX idx_entry_fund_transactions_user_id ON public.entry_fund_transactions(user_id);
CREATE INDEX idx_entry_fund_transactions_created_at ON public.entry_fund_transactions(created_at DESC);