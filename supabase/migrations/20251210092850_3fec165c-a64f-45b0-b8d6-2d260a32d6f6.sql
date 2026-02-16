-- 실제 결제 기록 기반으로 거래 데이터 복원
-- Stripe 결제: $1.79 (amount_total: 179 cents)
-- creator_fee: 6% = 0.1074 USD
-- platform_fee: 4% = 0.0716 USD
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
  stripe_payment_intent_id,
  created_at
)
SELECT 
  '2369c3e8-c2e7-43f6-800d-60dd2bd674c8'::uuid,
  ft.id,
  'buy',
  1,
  1.79,
  1.79,
  0.1074,  -- 6% of $1.79
  0.0716,  -- 4% of $1.79
  'USD',
  1.79,
  'pi_3SZvcWDVBCKJG9Po2w3LYUzS',
  '2025-12-02 15:36:29.88753+00'
FROM fanz_tokens ft
WHERE ft.token_id = 'd50e0123-e8b1-4df9-9cee-2c8805d29382';