-- Wiki Entry 채팅방 테이블
CREATE TABLE public.wiki_entry_chatrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Wiki Entry 채팅 메시지 테이블
CREATE TABLE public.wiki_entry_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatroom_id UUID NOT NULL REFERENCES public.wiki_entry_chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  original_message TEXT NOT NULL,
  translated_message TEXT NOT NULL,
  original_language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.wiki_entry_chatrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_entry_chat_messages ENABLE ROW LEVEL SECURITY;

-- 채팅방 조회: 모든 사람 가능
CREATE POLICY "Anyone can view chatrooms" 
ON public.wiki_entry_chatrooms 
FOR SELECT 
USING (true);

-- 채팅방 생성: lightstick 소유자만
CREATE POLICY "Lightstick holders can create chatrooms" 
ON public.wiki_entry_chatrooms 
FOR INSERT 
WITH CHECK (
  auth.uid() = creator_id AND
  EXISTS (
    SELECT 1 FROM public.fanz_balances fb
    JOIN public.fanz_tokens ft ON fb.fanz_token_id = ft.id
    WHERE fb.user_id = auth.uid()
    AND ft.wiki_entry_id = wiki_entry_chatrooms.wiki_entry_id
    AND fb.balance >= 1
  )
);

-- 채팅방 삭제: 생성자 또는 관리자
CREATE POLICY "Creators or admins can delete chatrooms" 
ON public.wiki_entry_chatrooms 
FOR DELETE 
USING (
  auth.uid() = creator_id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- 채팅 메시지 조회: 모든 사람 가능
CREATE POLICY "Anyone can view chat messages" 
ON public.wiki_entry_chat_messages 
FOR SELECT 
USING (true);

-- 채팅 메시지 작성: lightstick 소유자만
CREATE POLICY "Lightstick holders can send messages" 
ON public.wiki_entry_chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.wiki_entry_chatrooms cr
    JOIN public.fanz_balances fb ON EXISTS (
      SELECT 1 FROM public.fanz_tokens ft 
      WHERE ft.wiki_entry_id = cr.wiki_entry_id 
      AND ft.id = fb.fanz_token_id
    )
    WHERE cr.id = wiki_entry_chat_messages.chatroom_id
    AND fb.user_id = auth.uid()
    AND fb.balance >= 1
  )
);

-- 채팅 메시지 삭제: 본인 또는 관리자
CREATE POLICY "Users or admins can delete own messages" 
ON public.wiki_entry_chat_messages 
FOR DELETE 
USING (
  auth.uid() = user_id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- 인덱스 추가
CREATE INDEX idx_wiki_entry_chatrooms_wiki_entry_id ON public.wiki_entry_chatrooms(wiki_entry_id);
CREATE INDEX idx_wiki_entry_chat_messages_chatroom_id ON public.wiki_entry_chat_messages(chatroom_id);
CREATE INDEX idx_wiki_entry_chat_messages_created_at ON public.wiki_entry_chat_messages(created_at);