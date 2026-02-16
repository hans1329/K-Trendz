-- execute_fanztoken_purchase: Support Fund 적립 로직을 '항상' 수행하도록 수정 (20% = p_creator_fee 기준)

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
AS $function$
DECLARE
  v_wiki_entry_id uuid;
  v_support_fund_amount numeric;
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

  -- 4. Support Fund 적립
  -- UI/설명 기준: LightStick 구매의 20%가 Support Fund로 적립됨.
  -- 온체인/결제 흐름에서 계산된 p_creator_fee(=20% portion)를 그대로 사용하여 정확도 유지.
  SELECT wiki_entry_id INTO v_wiki_entry_id
  FROM fanz_tokens
  WHERE id = p_token_id;

  IF v_wiki_entry_id IS NOT NULL THEN
    v_support_fund_amount := COALESCE(p_creator_fee, 0);

    IF v_support_fund_amount > 0 THEN
      INSERT INTO entry_community_funds (wiki_entry_id, total_fund)
      VALUES (v_wiki_entry_id, v_support_fund_amount)
      ON CONFLICT (wiki_entry_id)
      DO UPDATE SET
        total_fund = entry_community_funds.total_fund + v_support_fund_amount,
        updated_at = now();

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
        v_support_fund_amount,
        'contribution',
        'LightStick purchase support fund deposit (20%)',
        v_transaction_id
      );
    END IF;
  END IF;
END;
$function$;

-- 이미 완료된 구매(2026-01-05)의 Support Fund 누락분을 1회 백필 (k-trendz-supporters)

-- Fund row가 없다면 생성
INSERT INTO public.entry_community_funds (wiki_entry_id, total_fund)
VALUES ('afc84912-ab2f-4fa5-9deb-ddc7f02be380', 0)
ON CONFLICT (wiki_entry_id) DO NOTHING;

-- 누락된 fund transaction 삽입 (중복 방지)
INSERT INTO public.entry_fund_transactions (
  wiki_entry_id,
  user_id,
  amount,
  transaction_type,
  description,
  fanz_transaction_id
)
SELECT
  t.wiki_entry_id,
  ft.user_id,
  ft.creator_fee,
  'contribution',
  'LightStick purchase support fund deposit (20%)',
  ft.id
FROM public.fanz_transactions ft
JOIN public.fanz_tokens t
  ON t.id = ft.fanz_token_id
WHERE ft.id = 'b86c500f-f41a-417c-a666-c00655f9aead'
  AND t.wiki_entry_id = 'afc84912-ab2f-4fa5-9deb-ddc7f02be380'
  AND COALESCE(ft.creator_fee, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.entry_fund_transactions eft
    WHERE eft.fanz_transaction_id = ft.id
  );

-- total_fund를 트랜잭션 합으로 재계산하여 정합성 보장
UPDATE public.entry_community_funds ecf
SET total_fund = sub.total_fund,
    updated_at = now()
FROM (
  SELECT wiki_entry_id, COALESCE(SUM(amount), 0) AS total_fund
  FROM public.entry_fund_transactions
  WHERE wiki_entry_id = 'afc84912-ab2f-4fa5-9deb-ddc7f02be380'
  GROUP BY wiki_entry_id
) sub
WHERE ecf.wiki_entry_id = sub.wiki_entry_id;