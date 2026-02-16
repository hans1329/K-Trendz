
-- agent_chat_messages에 status 컬럼 추가 (pending/approved/rejected)
ALTER TABLE public.agent_chat_messages 
ADD COLUMN status text NOT NULL DEFAULT 'approved';

-- 기존 메시지는 모두 approved 상태로 유지됨
-- 에이전트가 새로 생성하는 메시지는 pending으로 생성될 예정

-- status 컬럼에 인덱스 추가
CREATE INDEX idx_agent_chat_messages_status ON public.agent_chat_messages(status);

-- user_id + status 복합 인덱스 (내 에이전트의 pending 메시지 조회용)
CREATE INDEX idx_agent_chat_messages_user_status ON public.agent_chat_messages(user_id, status);
