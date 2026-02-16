
-- 에이전트 페르소나 테이블 (사전 정의된 AI 봇 캐릭터들)
CREATE TABLE public.agent_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🤖',
  favorite_artist_id UUID REFERENCES public.wiki_entries(id),
  personality TEXT NOT NULL DEFAULT 'enthusiastic fan',
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read agent personas"
  ON public.agent_personas FOR SELECT
  USING (true);

-- 관리자만 수정
CREATE POLICY "Admins can manage agent personas"
  ON public.agent_personas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 에이전트 채팅방 메시지 테이블
CREATE TABLE public.agent_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'user')),
  agent_persona_id UUID REFERENCES public.agent_personas(id),
  user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  topic_type TEXT DEFAULT 'general' CHECK (topic_type IN ('trading', 'voting', 'ranking', 'news', 'strategy', 'general', 'banter')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_chat_messages ENABLE ROW LEVEL SECURITY;

-- 누구나 메시지 읽기 가능
CREATE POLICY "Anyone can read agent chat messages"
  ON public.agent_chat_messages FOR SELECT
  USING (true);

-- 인증 유저는 유저 메시지 작성 가능
CREATE POLICY "Authenticated users can send messages"
  ON public.agent_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_type = 'user' AND user_id = auth.uid());

-- 본인 메시지 삭제 가능
CREATE POLICY "Users can delete own messages"
  ON public.agent_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- service_role로 에이전트 메시지 삽입 (edge function용)
-- service_role은 RLS를 우회하므로 별도 정책 불필요

-- 인덱스
CREATE INDEX idx_agent_chat_messages_created_at ON public.agent_chat_messages(created_at DESC);
CREATE INDEX idx_agent_chat_messages_topic ON public.agent_chat_messages(topic_type);

-- 초기 에이전트 페르소나 삽입
INSERT INTO public.agent_personas (name, avatar_emoji, personality, bio) VALUES
  ('FanBot Alpha', '🔥', 'aggressive trader who loves finding undervalued artists', 'I buy the dip and never sell! LightStick collector extraordinaire.'),
  ('StarGazer', '⭐', 'data-driven analyst who tracks rankings obsessively', 'Rankings never lie. I watch every chart movement and vote strategically.'),
  ('MelodyMaker', '🎵', 'cheerful supporter who loves discovering new artists', 'Every artist deserves love! I spread my LightSticks across rising stars.'),
  ('VoteKing', '👑', 'competitive voter who defends rankings aggressively', 'My artist WILL be #1. I vote with maximum weight and never miss a challenge.'),
  ('CryptoFan', '💎', 'strategic investor who thinks long-term about token economics', 'Diamond hands only. I analyze bonding curves and buy when the math is right.');
