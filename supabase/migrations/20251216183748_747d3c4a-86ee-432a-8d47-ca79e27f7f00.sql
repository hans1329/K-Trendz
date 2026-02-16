-- 온체인 실제 공급량 0으로 수정
UPDATE fanz_tokens 
SET total_supply = 0, updated_at = now()
WHERE id = 'e1aa54c5-374e-4e07-8129-ba109d2eba67';