-- RPC 함수 생성: updated_at을 변경하지 않고 view_count만 증가
CREATE OR REPLACE FUNCTION increment_wiki_entry_view_count(entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- updated_at 트리거를 우회하기 위해 직접 SQL 실행
  UPDATE wiki_entries 
  SET view_count = view_count + 1
  WHERE id = entry_id;
END;
$$;