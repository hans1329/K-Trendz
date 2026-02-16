-- 포스트가 연결된 모든 엔트리에 대해 합산점수 재계산
DO $$
DECLARE
  entry_id UUID;
BEGIN
  FOR entry_id IN 
    SELECT DISTINCT wiki_entry_id FROM posts WHERE wiki_entry_id IS NOT NULL
  LOOP
    PERFORM calculate_aggregated_scores(entry_id);
  END LOOP;
END $$;