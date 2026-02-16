-- 기존 fanz_tokens의 가격 설정을 0.5 USD 베이스로 업데이트
UPDATE fanz_tokens
SET 
  base_price = 0.00017,  -- 0.5 USD (at ETH = $3000)
  k_value = 0.000115     -- supply 5,000일 때 ~25 USD 도달
WHERE is_active = true;