-- Create proposal chat messages table
CREATE TABLE public.proposal_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.support_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_message TEXT NOT NULL,
  translated_message TEXT NOT NULL,
  original_language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_chat_messages ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read chat messages"
ON public.proposal_chat_messages
FOR SELECT
USING (true);

-- 응원봉 소유자만 채팅 가능 (lightstick_count >= 1)
CREATE POLICY "Lightstick holders can send messages"
ON public.proposal_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.fanz_balances fb
    JOIN public.fanz_tokens ft ON fb.fanz_token_id = ft.id
    JOIN public.support_proposals sp ON sp.wiki_entry_id = ft.wiki_entry_id
    WHERE sp.id = proposal_id
      AND fb.user_id = auth.uid()
      AND fb.balance >= 1
  )
);

-- 본인 메시지 삭제 가능
CREATE POLICY "Users can delete own messages"
ON public.proposal_chat_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_proposal_chat_messages_proposal_id ON public.proposal_chat_messages(proposal_id);
CREATE INDEX idx_proposal_chat_messages_created_at ON public.proposal_chat_messages(created_at DESC);