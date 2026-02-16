-- execute_fanztoken_purchase 함수에 커뮤니티 펀드 적립 로직 추가
CREATE OR REPLACE FUNCTION public.execute_fanztoken_purchase(
  p_token_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_price_per_token numeric,
  p_total_value numeric,
  p_creator_fee numeric,
  p_platform_fee numeric,
  p_payment_token text,
  p_payment_value numeric,
  p_tx_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wiki_entry_id uuid;
  v_community_fund_amount numeric;
  v_transaction_id uuid;
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
  )
  RETURNING id INTO v_transaction_id;

  -- 4. 커뮤니티 펀드 적립 (구매 금액의 10%)
  SELECT wiki_entry_id INTO v_wiki_entry_id
  FROM fanz_tokens
  WHERE id = p_token_id;

  IF v_wiki_entry_id IS NOT NULL THEN
    -- 커뮤니티 펀드 금액 계산 (총 구매 금액의 10%)
    v_community_fund_amount := p_total_value * 0.10;

    -- entry_community_funds 테이블 업데이트 또는 생성
    INSERT INTO entry_community_funds (wiki_entry_id, total_fund)
    VALUES (v_wiki_entry_id, v_community_fund_amount)
    ON CONFLICT (wiki_entry_id)
    DO UPDATE SET 
      total_fund = entry_community_funds.total_fund + v_community_fund_amount,
      updated_at = now();

    -- entry_fund_transactions에 기록
    INSERT INTO entry_fund_transactions (
      wiki_entry_id,
      user_id,
      amount,
      transaction_type,
      description,
      fanz_transaction_id
    ) VALUES (
      v_wiki_entry_id,
      p_user_id,
      v_community_fund_amount,
      'contribution',
      'Fanz Token purchase contribution (10%)',
      v_transaction_id
    );
  END IF;
END;
$$;