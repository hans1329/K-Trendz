-- 의견에 대한 찬반 투표 테이블 생성
CREATE TABLE public.support_proposal_opinion_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opinion_id UUID NOT NULL REFERENCES public.support_proposal_opinions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('for', 'against')),
  vote_weight INTEGER NOT NULL DEFAULT 1,
  lightstick_count INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (opinion_id, user_id)
);

-- 인덱스 추가
CREATE INDEX idx_opinion_votes_opinion_id ON public.support_proposal_opinion_votes(opinion_id);
CREATE INDEX idx_opinion_votes_user_id ON public.support_proposal_opinion_votes(user_id);

-- RLS 활성화
ALTER TABLE public.support_proposal_opinion_votes ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view opinion votes"
ON public.support_proposal_opinion_votes
FOR SELECT
USING (true);

-- RLS 정책: 인증된 사용자가 본인 투표 생성/수정
CREATE POLICY "Users can insert their own opinion votes"
ON public.support_proposal_opinion_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own opinion votes"
ON public.support_proposal_opinion_votes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opinion votes"
ON public.support_proposal_opinion_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 의견 테이블에 투표 집계 컬럼 추가
ALTER TABLE public.support_proposal_opinions 
ADD COLUMN IF NOT EXISTS votes_for INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS votes_against INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vote_weight INTEGER NOT NULL DEFAULT 0;

-- 투표 집계 트리거 함수
CREATE OR REPLACE FUNCTION update_opinion_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'for' THEN
      UPDATE public.support_proposal_opinions 
      SET votes_for = votes_for + NEW.vote_weight,
          total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.opinion_id;
    ELSE
      UPDATE public.support_proposal_opinions 
      SET votes_against = votes_against + NEW.vote_weight,
          total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.opinion_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 이전 투표 취소
    IF OLD.vote_type = 'for' THEN
      UPDATE public.support_proposal_opinions 
      SET votes_for = votes_for - OLD.vote_weight,
          total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.opinion_id;
    ELSE
      UPDATE public.support_proposal_opinions 
      SET votes_against = votes_against - OLD.vote_weight,
          total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.opinion_id;
    END IF;
    -- 새 투표 적용
    IF NEW.vote_type = 'for' THEN
      UPDATE public.support_proposal_opinions 
      SET votes_for = votes_for + NEW.vote_weight,
          total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.opinion_id;
    ELSE
      UPDATE public.support_proposal_opinions 
      SET votes_against = votes_against + NEW.vote_weight,
          total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.opinion_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'for' THEN
      UPDATE public.support_proposal_opinions 
      SET votes_for = votes_for - OLD.vote_weight,
          total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.opinion_id;
    ELSE
      UPDATE public.support_proposal_opinions 
      SET votes_against = votes_against - OLD.vote_weight,
          total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.opinion_id;
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 트리거 생성
CREATE TRIGGER trigger_update_opinion_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.support_proposal_opinion_votes
FOR EACH ROW
EXECUTE FUNCTION update_opinion_vote_counts();