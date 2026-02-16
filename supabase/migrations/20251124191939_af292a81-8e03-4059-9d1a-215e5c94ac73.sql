-- Fanz Token 구매 트랜잭션을 실행하는 함수
CREATE OR REPLACE FUNCTION execute_fanztoken_purchase(
  p_token_id UUID,
  p_user_id UUID,
  p_amount INTEGER,
  p_price_per_token NUMERIC,
  p_total_value NUMERIC,
  p_creator_fee NUMERIC,
  p_platform_fee NUMERIC,
  p_payment_token TEXT,
  p_payment_value NUMERIC,
  p_tx_hash TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. 토큰 총 공급량 증가
  UPDATE fanz_tokens
  SET total_supply = total_supply + p_amount,
      updated_at = now()
  WHERE id = p_token_id;

  -- 2. 사용자 잔액 업데이트 또는 생성
  INSERT INTO fanz_balances (user_id, fanz_token_id, balance)
  VALUES (p_user_id, p_token_id, p_amount)
  ON CONFLICT (user_id, fanz_token_id)
  DO UPDATE SET 
    balance = fanz_balances.balance + p_amount,
    updated_at = now();

  -- 3. 트랜잭션 기록
  INSERT INTO fanz_transactions (
    user_id,
    fanz_token_id,
    transaction_type,
    amount,
    price_per_token,
    total_value,
    creator_fee,
    platform_fee,
    payment_token,
    payment_value,
    tx_hash
  ) VALUES (
    p_user_id,
    p_token_id,
    'buy',
    p_amount,
    p_price_per_token,
    p_total_value,
    p_creator_fee,
    p_platform_fee,
    p_payment_token,
    p_payment_value,
    p_tx_hash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;