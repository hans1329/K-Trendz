-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS sync_wiki_votes_on_insert ON wiki_entry_votes;
DROP TRIGGER IF EXISTS sync_wiki_votes_on_update ON wiki_entry_votes;
DROP TRIGGER IF EXISTS sync_wiki_votes_on_delete ON wiki_entry_votes;
DROP TRIGGER IF EXISTS update_wiki_entry_votes_trigger ON wiki_entry_votes;

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS sync_wiki_entry_votes();
DROP FUNCTION IF EXISTS update_wiki_entry_votes_count();
DROP FUNCTION IF EXISTS calculate_wiki_entry_votes(uuid);

-- 새로운 증분 방식 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.increment_wiki_entry_votes()
RETURNS TRIGGER AS $$
DECLARE
  vote_change INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 새 투표 추가
    IF NEW.vote_type = 'up' THEN
      vote_change := 1;
    ELSE
      vote_change := -1;
    END IF;
    
    UPDATE wiki_entries
    SET votes = votes + vote_change
    WHERE id = NEW.wiki_entry_id;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- 투표 타입 변경 (up -> down 또는 down -> up)
    IF OLD.vote_type != NEW.vote_type THEN
      IF NEW.vote_type = 'up' THEN
        vote_change := 2;  -- down(-1) -> up(+1) = +2
      ELSE
        vote_change := -2; -- up(+1) -> down(-1) = -2
      END IF;
      
      UPDATE wiki_entries
      SET votes = votes + vote_change
      WHERE id = NEW.wiki_entry_id;
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- 투표 삭제
    IF OLD.vote_type = 'up' THEN
      vote_change := -1;
    ELSE
      vote_change := 1;
    END IF;
    
    UPDATE wiki_entries
    SET votes = votes + vote_change
    WHERE id = OLD.wiki_entry_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 새 트리거 생성
CREATE TRIGGER increment_wiki_votes_on_insert
AFTER INSERT ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION increment_wiki_entry_votes();

CREATE TRIGGER increment_wiki_votes_on_update
AFTER UPDATE ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION increment_wiki_entry_votes();

CREATE TRIGGER increment_wiki_votes_on_delete
AFTER DELETE ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION increment_wiki_entry_votes();