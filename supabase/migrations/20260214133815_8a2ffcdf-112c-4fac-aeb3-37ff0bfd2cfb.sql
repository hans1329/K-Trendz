
-- 유저 에이전트 (1인 1에이전트)
CREATE TABLE public.user_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Agent',
  avatar_emoji TEXT NOT NULL DEFAULT '🤖',
  personality TEXT NOT NULL DEFAULT 'friendly',
  favorite_entry_id UUID REFERENCES public.wiki_entries(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_agents_one_per_user UNIQUE (user_id)
);

-- 에이전트 규칙 (토글 ON/OFF)
CREATE TABLE public.user_agent_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID NOT NULL REFERENCES public.user_agents(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_agent_rules_unique UNIQUE (user_agent_id, rule_type)
);

-- 에이전트 활동 로그
CREATE TABLE public.agent_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID NOT NULL REFERENCES public.user_agents(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_user_agents_user_id ON public.user_agents(user_id);
CREATE INDEX idx_user_agent_rules_agent_id ON public.user_agent_rules(user_agent_id);
CREATE INDEX idx_agent_activity_log_agent_id ON public.agent_activity_log(user_agent_id);
CREATE INDEX idx_agent_activity_log_created ON public.agent_activity_log(created_at DESC);

-- RLS 활성화
ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

-- user_agents RLS
CREATE POLICY "Users can view own agent" ON public.user_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own agent" ON public.user_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agent" ON public.user_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agent" ON public.user_agents FOR DELETE USING (auth.uid() = user_id);

-- user_agent_rules RLS
CREATE POLICY "Users can view own agent rules" ON public.user_agent_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_agents WHERE id = user_agent_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own agent rules" ON public.user_agent_rules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_agents WHERE id = user_agent_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own agent rules" ON public.user_agent_rules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_agents WHERE id = user_agent_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own agent rules" ON public.user_agent_rules FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_agents WHERE id = user_agent_id AND user_id = auth.uid()));

-- agent_activity_log RLS
CREATE POLICY "Users can view own agent activity" ON public.agent_activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_agents WHERE id = user_agent_id AND user_id = auth.uid()));

-- updated_at 트리거
CREATE TRIGGER update_user_agents_updated_at BEFORE UPDATE ON public.user_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_agent_rules_updated_at BEFORE UPDATE ON public.user_agent_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
