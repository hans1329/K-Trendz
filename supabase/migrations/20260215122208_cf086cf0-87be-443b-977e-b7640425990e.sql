-- 잘못된 컨트랙트(0xC2E4...)로 기록된 온체인 해시를 리셋하여 올바른 DAU 컨트랙트로 재기록 가능하게 함
UPDATE agent_chat_messages 
SET onchain_tx_hash = NULL, onchain_batch_hash = NULL 
WHERE onchain_tx_hash IS NOT NULL;