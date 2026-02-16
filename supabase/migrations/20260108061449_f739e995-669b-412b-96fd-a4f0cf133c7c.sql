-- 모든 fanz_tokens의 k_value를 온체인과 동일하게 수정
UPDATE fanz_tokens 
SET k_value = 300000000000
WHERE token_id IN ('12666454296509763493', '7963681970480434413', '4607865675402095874');