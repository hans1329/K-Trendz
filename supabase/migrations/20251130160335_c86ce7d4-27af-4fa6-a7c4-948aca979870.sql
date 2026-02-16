-- 옛날 컨트랙트 주소를 참조하는 토큰들 삭제
-- 관련 fanz_balances와 fanz_transactions는 foreign key cascade로 자동 삭제됨

DELETE FROM fanz_tokens 
WHERE contract_address = '0x17fA29481424D933f52449719D5342841816B0B6';