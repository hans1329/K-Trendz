-- fanz_tokens 테이블을 V4 컨트랙트 주소와 올바른 k_value로 업데이트
UPDATE public.fanz_tokens
SET 
  contract_address = '0xA6940CC3a11bC8e43Fd343C0c86ddcf67D5f7dCe',
  k_value = 2000000000000
WHERE contract_address = '0x0f02469C9EBf296E33A70F335Ab5Df8BC876c33c' 
   OR k_value = 2;