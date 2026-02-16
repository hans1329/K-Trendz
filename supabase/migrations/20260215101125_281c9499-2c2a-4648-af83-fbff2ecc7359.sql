-- 유저가 자신의 에이전트 메시지를 삭제할 수 있도록 RLS DELETE 정책 추가
CREATE POLICY "Users can delete their own agent messages"
ON public.agent_chat_messages
FOR DELETE
USING (auth.uid() = user_id);