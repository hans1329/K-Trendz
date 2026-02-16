-- opinion 투표 시 votes_for/votes_against와 voter_count를 자동 업데이트하는 함수
CREATE OR REPLACE FUNCTION public.update_opinion_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
  old_vote_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 새 투표 추가
    IF NEW.vote_type = 'for' THEN
      UPDATE support_proposal_opinions
      SET votes_for = votes_for + 1,
          total_vote_weight = total_vote_weight + COALESCE(NEW.vote_weight, 0)
      WHERE id = NEW.opinion_id;
    ELSE
      UPDATE support_proposal_opinions
      SET votes_against = votes_against + 1,
          total_vote_weight = total_vote_weight + COALESCE(NEW.vote_weight, 0)
      WHERE id = NEW.opinion_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- 투표 변경 (기존 투표 취소하고 새 투표 적용)
    IF OLD.vote_type = 'for' THEN
      UPDATE support_proposal_opinions
      SET votes_for = GREATEST(0, votes_for - 1),
          total_vote_weight = GREATEST(0, total_vote_weight - COALESCE(OLD.vote_weight, 0))
      WHERE id = OLD.opinion_id;
    ELSE
      UPDATE support_proposal_opinions
      SET votes_against = GREATEST(0, votes_against - 1),
          total_vote_weight = GREATEST(0, total_vote_weight - COALESCE(OLD.vote_weight, 0))
      WHERE id = OLD.opinion_id;
    END IF;
    
    IF NEW.vote_type = 'for' THEN
      UPDATE support_proposal_opinions
      SET votes_for = votes_for + 1,
          total_vote_weight = total_vote_weight + COALESCE(NEW.vote_weight, 0)
      WHERE id = NEW.opinion_id;
    ELSE
      UPDATE support_proposal_opinions
      SET votes_against = votes_against + 1,
          total_vote_weight = total_vote_weight + COALESCE(NEW.vote_weight, 0)
      WHERE id = NEW.opinion_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- 투표 삭제
    IF OLD.vote_type = 'for' THEN
      UPDATE support_proposal_opinions
      SET votes_for = GREATEST(0, votes_for - 1),
          total_vote_weight = GREATEST(0, total_vote_weight - COALESCE(OLD.vote_weight, 0))
      WHERE id = OLD.opinion_id;
    ELSE
      UPDATE support_proposal_opinions
      SET votes_against = GREATEST(0, votes_against - 1),
          total_vote_weight = GREATEST(0, total_vote_weight - COALESCE(OLD.vote_weight, 0))
      WHERE id = OLD.opinion_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 기존 트리거가 있으면 삭제
DROP TRIGGER IF EXISTS trigger_update_opinion_vote_counts ON support_proposal_opinion_votes;

-- 트리거 생성
CREATE TRIGGER trigger_update_opinion_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON support_proposal_opinion_votes
FOR EACH ROW
EXECUTE FUNCTION update_opinion_vote_counts();

-- 기존 데이터 동기화: 현재 votes 테이블 기준으로 opinions 카운트 재계산
UPDATE support_proposal_opinions o
SET 
  votes_for = (
    SELECT COUNT(*) FROM support_proposal_opinion_votes v 
    WHERE v.opinion_id = o.id AND v.vote_type = 'for'
  ),
  votes_against = (
    SELECT COUNT(*) FROM support_proposal_opinion_votes v 
    WHERE v.opinion_id = o.id AND v.vote_type = 'against'
  ),
  total_vote_weight = (
    SELECT COALESCE(SUM(vote_weight), 0) FROM support_proposal_opinion_votes v 
    WHERE v.opinion_id = o.id
  );