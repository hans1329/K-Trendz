-- fanz_tokens 테이블의 base_price, k_value를 온체인 값과 일치시킴
UPDATE fanz_tokens 
SET 
  base_price = 0.95,
  k_value = 0.5,
  total_supply = 1,
  updated_at = now()
WHERE id = 'e1aa54c5-374e-4e07-8129-ba109d2eba67';