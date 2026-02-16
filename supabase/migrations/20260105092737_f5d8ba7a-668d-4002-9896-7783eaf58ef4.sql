-- K-Trendz Supporters의 total_supply를 0으로 리셋 (V4 재등록 후 상태 동기화)
UPDATE fanz_tokens 
SET total_supply = 0, updated_at = now()
WHERE token_id = '12666454296509763493';