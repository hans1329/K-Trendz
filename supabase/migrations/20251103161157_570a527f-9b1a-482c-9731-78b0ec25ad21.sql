-- Fix search_path for get_wiki_entry_comment_count function
DROP FUNCTION IF EXISTS get_wiki_entry_comment_count(uuid);

CREATE OR REPLACE FUNCTION get_wiki_entry_comment_count(entry_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM comments
  WHERE wiki_entry_id = entry_id;
$$;