-- sync_wiki_entry_votes 함수에 search_path 설정
CREATE OR REPLACE FUNCTION sync_wiki_entry_votes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
$$;