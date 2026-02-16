-- 기존 RLS 정책 삭제 후 더 안전한 정책으로 교체
DROP POLICY IF EXISTS "Users can view own sessions" ON public.lol_chat_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON public.lol_chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.lol_chat_sessions;
DROP POLICY IF EXISTS "Users can view messages in own sessions" ON public.lol_chat_messages;
DROP POLICY IF EXISTS "Users can create messages in own sessions" ON public.lol_chat_messages;
DROP POLICY IF EXISTS "Users can update messages in own sessions" ON public.lol_chat_messages;

-- 로그인 유저용 세션 정책 (user_id 기반)
CREATE POLICY "Authenticated users can view own sessions" 
ON public.lol_chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create sessions" 
ON public.lol_chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own sessions" 
ON public.lol_chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 비로그인 유저용 세션 정책 (서비스 역할을 통해 edge function에서만 처리)
-- 비로그인 유저는 edge function의 service role을 통해서만 DB 접근

-- 로그인 유저용 메시지 정책
CREATE POLICY "Authenticated users can view messages in own sessions" 
ON public.lol_chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND auth.uid() = user_id
  )
);

CREATE POLICY "Authenticated users can create messages in own sessions" 
ON public.lol_chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND auth.uid() = user_id
  )
);

CREATE POLICY "Authenticated users can update messages in own sessions" 
ON public.lol_chat_messages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND auth.uid() = user_id
  )
);