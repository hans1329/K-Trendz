-- 챌린지 테이블 생성
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  correct_answer text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb, -- 객관식 선택지
  total_prize_usdc numeric NOT NULL DEFAULT 0,
  winner_count integer NOT NULL DEFAULT 1,
  prize_with_lightstick numeric NOT NULL DEFAULT 0, -- 응원봉 소유자 당첨금
  prize_without_lightstick numeric NOT NULL DEFAULT 0, -- 비소유자 당첨금
  wiki_entry_id uuid REFERENCES public.wiki_entries(id) ON DELETE SET NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active, ended, cancelled
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 챌린지 참여 테이블
CREATE TABLE public.challenge_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  answer text NOT NULL,
  has_lightstick boolean NOT NULL DEFAULT false,
  is_winner boolean DEFAULT null, -- null: 미정, true: 당첨, false: 미당첨
  prize_amount numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

-- RLS 활성화
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participations ENABLE ROW LEVEL SECURITY;

-- Challenges RLS 정책
CREATE POLICY "Anyone can view active challenges"
ON public.challenges FOR SELECT
USING (status = 'active' OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create challenges"
ON public.challenges FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update challenges"
ON public.challenges FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete challenges"
ON public.challenges FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Challenge participations RLS 정책
CREATE POLICY "Anyone can view participations"
ON public.challenge_participations FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can participate"
ON public.challenge_participations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update participations"
ON public.challenge_participations FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- 인덱스
CREATE INDEX idx_challenges_status ON public.challenges(status);
CREATE INDEX idx_challenges_end_time ON public.challenges(end_time);
CREATE INDEX idx_challenge_participations_challenge ON public.challenge_participations(challenge_id);
CREATE INDEX idx_challenge_participations_user ON public.challenge_participations(user_id);