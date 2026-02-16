-- 특별 투표 이벤트 테이블
CREATE TABLE public.special_vote_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id uuid NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 특별 투표 기록 테이블
CREATE TABLE public.special_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.special_vote_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  vote_count integer NOT NULL DEFAULT 1,
  fingerprint text,
  ip_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX idx_special_vote_events_active ON public.special_vote_events(is_active, end_time);
CREATE INDEX idx_special_vote_events_wiki_entry ON public.special_vote_events(wiki_entry_id);
CREATE INDEX idx_special_votes_event_id ON public.special_votes(event_id);
CREATE INDEX idx_special_votes_user_id ON public.special_votes(user_id);
CREATE INDEX idx_special_votes_fingerprint ON public.special_votes(fingerprint);

-- RLS 활성화
ALTER TABLE public.special_vote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_votes ENABLE ROW LEVEL SECURITY;

-- 이벤트 정책
CREATE POLICY "Anyone can view active events"
ON public.special_vote_events FOR SELECT
USING (is_active = true AND end_time > now());

CREATE POLICY "Admins can manage events"
ON public.special_vote_events FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 투표 정책
CREATE POLICY "Anyone can view votes"
ON public.special_votes FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert votes"
ON public.special_votes FOR INSERT
WITH CHECK (true);

-- 실시간 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE special_vote_events;
ALTER PUBLICATION supabase_realtime ADD TABLE special_votes;