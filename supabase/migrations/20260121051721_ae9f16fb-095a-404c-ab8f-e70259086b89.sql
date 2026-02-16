-- LoL 코치 대화 세션 테이블
CREATE TABLE public.lol_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- 비로그인 유저용 (IP hash 등)
  sample_user_key TEXT NOT NULL, -- 선택한 샘플 유저 ('beginner', 'bronze', 'gold')
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- LoL 코치 대화 메시지 테이블
CREATE TABLE public.lol_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.lol_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'normal' CHECK (message_type IN ('normal', 'celebration')),
  feedback TEXT CHECK (feedback IN ('up', 'down')),
  token_cost NUMERIC(10, 6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 인덱스 추가
CREATE INDEX idx_lol_chat_sessions_user_id ON public.lol_chat_sessions(user_id);
CREATE INDEX idx_lol_chat_sessions_session_id ON public.lol_chat_sessions(session_id);
CREATE INDEX idx_lol_chat_messages_session_id ON public.lol_chat_messages(session_id);

-- RLS 활성화
ALTER TABLE public.lol_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lol_chat_messages ENABLE ROW LEVEL SECURITY;

-- 세션 RLS 정책: 본인 세션만 접근 가능
CREATE POLICY "Users can view own sessions" 
ON public.lol_chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create sessions" 
ON public.lol_chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions" 
ON public.lol_chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- 메시지 RLS 정책: 본인 세션의 메시지만 접근 가능
CREATE POLICY "Users can view messages in own sessions" 
ON public.lol_chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND (auth.uid() = user_id OR user_id IS NULL)
  )
);

CREATE POLICY "Users can create messages in own sessions" 
ON public.lol_chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND (auth.uid() = user_id OR user_id IS NULL)
  )
);

CREATE POLICY "Users can update messages in own sessions" 
ON public.lol_chat_messages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.lol_chat_sessions 
    WHERE id = lol_chat_messages.session_id 
    AND (auth.uid() = user_id OR user_id IS NULL)
  )
);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_lol_chat_sessions_updated_at
BEFORE UPDATE ON public.lol_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();