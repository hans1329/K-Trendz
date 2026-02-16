-- wiki_entries에 합산 점수 컬럼 추가
ALTER TABLE wiki_entries
ADD COLUMN aggregated_trending_score INTEGER DEFAULT 0,
ADD COLUMN aggregated_votes INTEGER DEFAULT 0,
ADD COLUMN aggregated_view_count INTEGER DEFAULT 0,
ADD COLUMN aggregated_follower_count INTEGER DEFAULT 0;

-- 하위 엔트리들의 점수를 합산하는 함수
CREATE OR REPLACE FUNCTION calculate_aggregated_scores(entry_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  entry_scores RECORD;
  child_scores RECORD;
BEGIN
  -- 현재 엔트리의 자체 점수 가져오기
  SELECT 
    trending_score,
    votes,
    view_count,
    follower_count
  INTO entry_scores
  FROM wiki_entries
  WHERE id = entry_id_param;

  -- 하위 엔트리들의 점수 합산
  SELECT 
    COALESCE(SUM(trending_score), 0) as total_trending,
    COALESCE(SUM(votes), 0) as total_votes,
    COALESCE(SUM(view_count), 0) as total_views,
    COALESCE(SUM(follower_count), 0) as total_followers
  INTO child_scores
  FROM wiki_entries child
  WHERE child.id IN (
    SELECT child_entry_id 
    FROM wiki_entry_relationships 
    WHERE parent_entry_id = entry_id_param
  );

  -- 합산 점수 업데이트
  UPDATE wiki_entries
  SET 
    aggregated_trending_score = COALESCE(entry_scores.trending_score, 0) + child_scores.total_trending,
    aggregated_votes = COALESCE(entry_scores.votes, 0) + child_scores.total_votes,
    aggregated_view_count = COALESCE(entry_scores.view_count, 0) + child_scores.total_views,
    aggregated_follower_count = COALESCE(entry_scores.follower_count, 0) + child_scores.total_followers
  WHERE id = entry_id_param;
END;
$$;

-- 엔트리의 점수가 변경될 때 자신과 부모의 합산 점수 업데이트
CREATE OR REPLACE FUNCTION update_aggregated_scores_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_ids UUID[];
BEGIN
  -- 자신의 합산 점수 업데이트
  PERFORM calculate_aggregated_scores(NEW.id);
  
  -- 부모 엔트리들의 합산 점수 업데이트
  SELECT ARRAY_AGG(parent_entry_id) INTO parent_ids
  FROM wiki_entry_relationships
  WHERE child_entry_id = NEW.id;
  
  IF parent_ids IS NOT NULL THEN
    FOR i IN 1..array_length(parent_ids, 1) LOOP
      PERFORM calculate_aggregated_scores(parent_ids[i]);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 관계가 추가/삭제될 때 합산 점수 업데이트
CREATE OR REPLACE FUNCTION update_aggregated_scores_on_relationship_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- 부모와 자식 모두 업데이트
    PERFORM calculate_aggregated_scores(NEW.parent_entry_id);
    PERFORM calculate_aggregated_scores(NEW.child_entry_id);
  ELSIF TG_OP = 'DELETE' THEN
    -- 부모와 자식 모두 업데이트
    PERFORM calculate_aggregated_scores(OLD.parent_entry_id);
    PERFORM calculate_aggregated_scores(OLD.child_entry_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 트리거 생성: wiki_entries의 점수 변경 시
CREATE TRIGGER trigger_update_aggregated_scores_on_entry_change
AFTER UPDATE OF trending_score, votes, view_count, follower_count ON wiki_entries
FOR EACH ROW
EXECUTE FUNCTION update_aggregated_scores_on_change();

-- 트리거 생성: wiki_entry_relationships 변경 시
CREATE TRIGGER trigger_update_aggregated_scores_on_relationship_change
AFTER INSERT OR UPDATE OR DELETE ON wiki_entry_relationships
FOR EACH ROW
EXECUTE FUNCTION update_aggregated_scores_on_relationship_change();

-- 기존 모든 엔트리의 합산 점수 초기화
DO $$
DECLARE
  entry_record RECORD;
BEGIN
  FOR entry_record IN SELECT id FROM wiki_entries LOOP
    PERFORM calculate_aggregated_scores(entry_record.id);
  END LOOP;
END $$;