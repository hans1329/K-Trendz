-- wiki_entry_votes 트리거 다시 생성
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