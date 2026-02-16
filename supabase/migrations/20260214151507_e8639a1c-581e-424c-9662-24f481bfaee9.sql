-- 사용자가 자신의 에이전트 메시지를 승인/거절할 수 있도록 UPDATE 정책 추가
CREATE POLICY "Users can update own agent messages"
ON public.agent_chat_messages
FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));