
-- agent_chat_messages에 status 컬럼 추가 (pending/approved/rejected)
ALTER TABLE public.agent_chat_messages 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- status 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_status ON public.agent_chat_messages(status);

-- user_id + status 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_user_status ON public.agent_chat_messages(user_id, status);
