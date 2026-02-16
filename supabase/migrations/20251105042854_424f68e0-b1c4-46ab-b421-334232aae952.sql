-- wiki_entries 테이블의 votes 컬럼을 실제 투표 수와 동기화하는 함수
CREATE OR REPLACE FUNCTION sync_wiki_entry_votes()
RETURNS TRIGGER AS $$
BEGIN
  -- 투표가 추가/변경/삭제될 때마다 wiki_entries의 votes를 재계산
  UPDATE wiki_entries
  SET votes = (
    SELECT COUNT(CASE WHEN vote_type = 'up' THEN 1 END) - 
           COUNT(CASE WHEN vote_type = 'down' THEN 1 END)
    FROM wiki_entry_votes
    WHERE wiki_entry_id = COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id)
  )
  WHERE id = COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있다면 삭제
DROP TRIGGER IF EXISTS sync_wiki_votes_on_insert ON wiki_entry_votes;
DROP TRIGGER IF EXISTS sync_wiki_votes_on_update ON wiki_entry_votes;
DROP TRIGGER IF EXISTS sync_wiki_votes_on_delete ON wiki_entry_votes;

-- 투표 추가시 트리거
CREATE TRIGGER sync_wiki_votes_on_insert
AFTER INSERT ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION sync_wiki_entry_votes();

-- 투표 변경시 트리거
CREATE TRIGGER sync_wiki_votes_on_update
AFTER UPDATE ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION sync_wiki_entry_votes();

-- 투표 삭제시 트리거
CREATE TRIGGER sync_wiki_votes_on_delete
AFTER DELETE ON wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION sync_wiki_entry_votes();

-- 기존 데이터 동기화
UPDATE wiki_entries we
SET votes = (
  SELECT COUNT(CASE WHEN vote_type = 'up' THEN 1 END) - 
         COUNT(CASE WHEN vote_type = 'down' THEN 1 END)
  FROM wiki_entry_votes wev
  WHERE wev.wiki_entry_id = we.id
);