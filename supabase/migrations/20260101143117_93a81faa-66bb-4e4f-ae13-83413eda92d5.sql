-- 후원 제안 테이블
CREATE TABLE public.support_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'general', -- general, event, merchandise, donation
  requested_amount NUMERIC DEFAULT 0, -- 요청 금액 (펀드에서 사용)
  status TEXT NOT NULL DEFAULT 'voting', -- voting, passed, rejected, executed, expired
  voting_start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  voting_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  quorum_threshold INTEGER NOT NULL DEFAULT 30, -- 정족수 % (총 투표권 대비)
  pass_threshold INTEGER NOT NULL DEFAULT 50, -- 통과 기준 % (찬성 비율)
  total_votes_for INTEGER NOT NULL DEFAULT 0,
  total_votes_against INTEGER NOT NULL DEFAULT 0,
  total_vote_weight INTEGER NOT NULL DEFAULT 0, -- 가중치 합산
  tx_hash TEXT, -- 온체인 기록 트랜잭션
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 제안 투표 테이블
CREATE TABLE public.support_proposal_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.support_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL, -- for, against
  vote_weight INTEGER NOT NULL DEFAULT 1, -- Tier 기반 가중치
  lightstick_count INTEGER NOT NULL DEFAULT 0, -- 투표 시점 보유량
  tx_hash TEXT, -- 온체인 기록 트랜잭션
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- RLS 활성화
ALTER TABLE public.support_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_proposal_votes ENABLE ROW LEVEL SECURITY;

-- support_proposals RLS 정책
CREATE POLICY "Anyone can view proposals" 
  ON public.support_proposals FOR SELECT 
  USING (true);

CREATE POLICY "Lightstick holders can create proposals" 
  ON public.support_proposals FOR INSERT 
  WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "Proposers can update their pending proposals" 
  ON public.support_proposals FOR UPDATE 
  USING (auth.uid() = proposer_id AND status = 'voting');

CREATE POLICY "Admins can manage proposals" 
  ON public.support_proposals FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- support_proposal_votes RLS 정책
CREATE POLICY "Anyone can view votes" 
  ON public.support_proposal_votes FOR SELECT 
  USING (true);

CREATE POLICY "Users can vote" 
  ON public.support_proposal_votes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their vote" 
  ON public.support_proposal_votes FOR UPDATE 
  USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX idx_support_proposals_wiki_entry ON public.support_proposals(wiki_entry_id);
CREATE INDEX idx_support_proposals_status ON public.support_proposals(status);
CREATE INDEX idx_support_proposal_votes_proposal ON public.support_proposal_votes(proposal_id);
CREATE INDEX idx_support_proposal_votes_user ON public.support_proposal_votes(user_id);

-- 투표 가중치 계산 함수 (Tier 기반)
CREATE OR REPLACE FUNCTION public.calculate_vote_weight(lightstick_count INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lightstick_count >= 100 THEN 5  -- Diamond
    WHEN lightstick_count >= 50 THEN 4   -- Gold
    WHEN lightstick_count >= 20 THEN 3   -- Silver
    WHEN lightstick_count >= 5 THEN 2    -- Bronze
    WHEN lightstick_count >= 1 THEN 1    -- Basic
    ELSE 0                                -- No lightstick
  END;
$$;

-- 투표 후 집계 업데이트 트리거
CREATE OR REPLACE FUNCTION public.update_proposal_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'for' THEN
      UPDATE support_proposals
      SET 
        total_votes_for = total_votes_for + 1,
        total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.proposal_id;
    ELSE
      UPDATE support_proposals
      SET 
        total_votes_against = total_votes_against + 1,
        total_vote_weight = total_vote_weight + NEW.vote_weight
      WHERE id = NEW.proposal_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type != NEW.vote_type THEN
      IF NEW.vote_type = 'for' THEN
        UPDATE support_proposals
        SET 
          total_votes_for = total_votes_for + 1,
          total_votes_against = total_votes_against - 1
        WHERE id = NEW.proposal_id;
      ELSE
        UPDATE support_proposals
        SET 
          total_votes_for = total_votes_for - 1,
          total_votes_against = total_votes_against + 1
        WHERE id = NEW.proposal_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'for' THEN
      UPDATE support_proposals
      SET 
        total_votes_for = total_votes_for - 1,
        total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.proposal_id;
    ELSE
      UPDATE support_proposals
      SET 
        total_votes_against = total_votes_against - 1,
        total_vote_weight = total_vote_weight - OLD.vote_weight
      WHERE id = OLD.proposal_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_proposal_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.support_proposal_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_proposal_vote_counts();