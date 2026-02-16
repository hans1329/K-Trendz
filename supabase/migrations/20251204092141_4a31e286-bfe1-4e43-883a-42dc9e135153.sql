-- calculate_aggregated_scores 함수 수정: 포스트 점수 포함
CREATE OR REPLACE FUNCTION public.calculate_aggregated_scores(entry_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  entry_scores RECORD;
  child_scores RECORD;
  post_scores RECORD;
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

  -- 연결된 포스트들의 점수 합산 (기본 10 + votes×2 + views×1)
  SELECT 
    COALESCE(SUM(10 + (COALESCE(votes, 0) * 2) + COALESCE(view_count, 0)), 0) as total_post_score
  INTO post_scores
  FROM posts
  WHERE wiki_entry_id = entry_id_param
    AND is_approved = true;

  -- 합산 점수 업데이트 (포스트 점수 포함)
  UPDATE wiki_entries
  SET 
    aggregated_trending_score = COALESCE(entry_scores.trending_score, 0) + child_scores.total_trending + post_scores.total_post_score,
    aggregated_votes = COALESCE(entry_scores.votes, 0) + child_scores.total_votes,
    aggregated_view_count = COALESCE(entry_scores.view_count, 0) + child_scores.total_views,
    aggregated_follower_count = COALESCE(entry_scores.follower_count, 0) + child_scores.total_followers
  WHERE id = entry_id_param;
END;
$function$;