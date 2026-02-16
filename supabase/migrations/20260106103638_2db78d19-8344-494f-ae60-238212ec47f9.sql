-- IVE 토큰의 k_value를 V4 온체인 값과 동일하게 수정 (0.3 USDC = 0.3)
UPDATE fanz_tokens 
SET k_value = 0.3,
    total_supply = 0
WHERE id = '25ea9902-194c-4939-bb1f-9485a32e91ba';