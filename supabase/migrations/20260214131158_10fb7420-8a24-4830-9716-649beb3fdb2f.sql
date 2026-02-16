
-- 에이전트 채팅 Cron 설정 테이블
CREATE TABLE public.agent_chat_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  interval_minutes INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS 활성화
ALTER TABLE public.agent_chat_settings ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read agent chat settings"
  ON public.agent_chat_settings FOR SELECT
  USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Admins can update agent chat settings"
  ON public.agent_chat_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert agent chat settings"
  ON public.agent_chat_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 초기 설정 삽입
INSERT INTO public.agent_chat_settings (is_enabled, interval_minutes)
VALUES (false, 10);
