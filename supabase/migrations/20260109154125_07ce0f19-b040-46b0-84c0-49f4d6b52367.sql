-- 출금 처리를 위한 안전한 atomic 함수 생성
CREATE OR REPLACE FUNCTION public.process_usdc_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_fee NUMERIC,
  p_to_address TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  transaction_id UUID,
  previous_balance NUMERIC,
  new_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_tx_id UUID;
  v_recent_withdrawal TIMESTAMPTZ;
  v_daily_total NUMERIC;
BEGIN
  -- 1. Row Lock으로 잔액 조회 (FOR UPDATE로 다른 트랜잭션 차단)
  SELECT balance INTO v_current_balance
  FROM usdc_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 잔액 레코드가 없으면 0으로 간주
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- 2. 잔액 부족 확인
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('Insufficient balance. Available: $%s', v_current_balance::TEXT),
      NULL::UUID,
      v_current_balance,
      v_current_balance;
    RETURN;
  END IF;

  -- 3. 중복 출금 방지 (30초 내 동일 금액 출금 차단)
  SELECT created_at INTO v_recent_withdrawal
  FROM usdc_transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'withdrawal'
    AND amount = -p_amount
    AND status IN ('pending', 'completed')
    AND created_at > NOW() - INTERVAL '30 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent_withdrawal IS NOT NULL THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Duplicate withdrawal detected. Please wait 30 seconds.',
      NULL::UUID,
      v_current_balance,
      v_current_balance;
    RETURN;
  END IF;

  -- 4. 일일 출금 한도 확인 ($500/day)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM usdc_transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'withdrawal'
    AND status = 'completed'
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_total + p_amount > 500 THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('Daily withdrawal limit exceeded. Used: $%s of $500', v_daily_total::TEXT),
      NULL::UUID,
      v_current_balance,
      v_current_balance;
    RETURN;
  END IF;

  -- 5. 단건 한도 확인 ($200/transaction)
  IF p_amount > 200 THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Single withdrawal limit is $200',
      NULL::UUID,
      v_current_balance,
      v_current_balance;
    RETURN;
  END IF;

  -- 6. 잔액 차감 (atomic)
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE usdc_balances
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 7. 트랜잭션 기록 생성
  INSERT INTO usdc_transactions (
    user_id,
    amount,
    fee,
    transaction_type,
    reference_id,
    status
  ) VALUES (
    p_user_id,
    -p_amount,
    p_fee,
    'withdrawal',
    p_to_address,
    'pending'
  )
  RETURNING id INTO v_tx_id;

  -- 성공 반환
  RETURN QUERY SELECT 
    TRUE,
    NULL::TEXT,
    v_tx_id,
    v_current_balance,
    v_new_balance;
END;
$$;

-- 출금 실패 시 잔액 복구 함수
CREATE OR REPLACE FUNCTION public.revert_usdc_withdrawal(
  p_transaction_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  -- 트랜잭션 정보 조회 및 상태 확인
  SELECT ABS(amount) INTO v_amount
  FROM usdc_transactions
  WHERE id = p_transaction_id
    AND user_id = p_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF v_amount IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 잔액 복구
  UPDATE usdc_balances
  SET balance = balance + v_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 트랜잭션 상태 업데이트
  UPDATE usdc_transactions
  SET status = 'failed'
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;