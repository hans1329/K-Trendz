-- Fanz Tokens Tables and Functions

-- fanz_tokens 테이블: 각 엔트리/포스트별 토큰 메타데이터
CREATE TABLE fanz_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_entry_id UUID REFERENCES wiki_entries(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL UNIQUE,
  base_price NUMERIC NOT NULL DEFAULT 0.001,
  k_value NUMERIC NOT NULL DEFAULT 0.0001,
  total_supply BIGINT NOT NULL DEFAULT 0,
  buy_fee_creator_percent INTEGER NOT NULL DEFAULT 6,
  buy_fee_platform_percent INTEGER NOT NULL DEFAULT 4,
  sell_fee_percent INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  contract_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fanz_tokens_entry_or_post_check CHECK (
    (wiki_entry_id IS NOT NULL AND post_id IS NULL) OR
    (wiki_entry_id IS NULL AND post_id IS NOT NULL)
  )
);

-- fanz_balances 테이블: 사용자별 토큰 보유량
CREATE TABLE fanz_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fanz_token_id UUID NOT NULL REFERENCES fanz_tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fanz_token_id, user_id)
);

-- fanz_transactions 테이블: 토큰 거래 내역
CREATE TABLE fanz_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fanz_token_id UUID NOT NULL REFERENCES fanz_tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'mint')),
  amount BIGINT NOT NULL,
  price_per_token NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  payment_token TEXT NOT NULL DEFAULT 'ETH',
  payment_value NUMERIC NOT NULL,
  creator_fee NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX idx_fanz_tokens_wiki_entry ON fanz_tokens(wiki_entry_id) WHERE wiki_entry_id IS NOT NULL;
CREATE INDEX idx_fanz_tokens_post ON fanz_tokens(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_fanz_tokens_creator ON fanz_tokens(creator_id);
CREATE INDEX idx_fanz_balances_user ON fanz_balances(user_id);
CREATE INDEX idx_fanz_balances_token ON fanz_balances(fanz_token_id);
CREATE INDEX idx_fanz_transactions_user ON fanz_transactions(user_id);
CREATE INDEX idx_fanz_transactions_token ON fanz_transactions(fanz_token_id);

-- RLS 활성화
ALTER TABLE fanz_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fanz_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fanz_transactions ENABLE ROW LEVEL SECURITY;

-- fanz_tokens RLS 정책
CREATE POLICY "Fanz tokens are viewable by everyone"
  ON fanz_tokens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Creators can insert fanz tokens"
  ON fanz_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their fanz tokens"
  ON fanz_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id);

-- fanz_balances RLS 정책
CREATE POLICY "Fanz balances are viewable by everyone"
  ON fanz_balances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert balances"
  ON fanz_balances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update balances"
  ON fanz_balances FOR UPDATE
  TO authenticated
  USING (true);

-- fanz_transactions RLS 정책
CREATE POLICY "Fanz transactions are viewable by everyone"
  ON fanz_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create transactions"
  ON fanz_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- updated_at 트리거
CREATE TRIGGER set_fanz_tokens_updated_at
  BEFORE UPDATE ON fanz_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_fanz_balances_updated_at
  BEFORE UPDATE ON fanz_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 본딩커브 가격 계산 함수: P(s) = basePrice + k * sqrt(supply)
CREATE OR REPLACE FUNCTION calculate_fanz_token_price(
  token_id_param UUID,
  supply_param BIGINT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
  current_supply BIGINT;
BEGIN
  SELECT base_price, k_value, total_supply
  INTO token_record
  FROM fanz_tokens
  WHERE id = token_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  
  current_supply := COALESCE(supply_param, token_record.total_supply);
  
  -- P(s) = basePrice + k * sqrt(supply)
  RETURN token_record.base_price + (token_record.k_value * SQRT(current_supply));
END;
$$;