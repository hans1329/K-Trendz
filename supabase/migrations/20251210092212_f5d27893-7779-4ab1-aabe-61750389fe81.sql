-- 잘못된 테스트 거래 데이터 삭제
DELETE FROM fanz_transactions 
WHERE creator_fee = 0.09778572683999999 
  AND total_value = 1.7927383254;