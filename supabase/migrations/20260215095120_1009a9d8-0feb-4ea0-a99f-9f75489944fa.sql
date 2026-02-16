-- 에이전트 메시지 온체인 배치 해시 기록을 위한 컬럼 추가
ALTER TABLE public.agent_chat_messages 
ADD COLUMN IF NOT EXISTS onchain_batch_hash text,
ADD COLUMN IF NOT EXISTS onchain_tx_hash text;

-- 배치 해시로 조회하기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_batch_hash 
ON public.agent_chat_messages(onchain_batch_hash) 
WHERE onchain_batch_hash IS NOT NULL;

-- 온체인 기록 여부로 필터링하기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_tx_hash 
ON public.agent_chat_messages(onchain_tx_hash) 
WHERE onchain_tx_hash IS NOT NULL;