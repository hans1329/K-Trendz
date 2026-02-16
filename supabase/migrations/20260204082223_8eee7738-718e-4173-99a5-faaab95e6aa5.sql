-- 온체인 nonce 동기화를 위해 현재 nonce 값 리셋
-- 다음 트랜잭션 시 온체인에서 실제 nonce를 가져와 동기화됨
UPDATE onchain_nonces 
SET current_nonce = 0 
WHERE sender_address = '0x8B4197d938b8F4212B067e9925F7251B6C21B856';