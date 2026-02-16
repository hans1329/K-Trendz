-- Fanz Token을 점수 계산에 반영

-- Fanz Token 점수 계산 함수 생성 (각 토큰 = 1점)
CREATE OR REPLACE FUNCTION public.calculate_fanz_token_score(entry_id_param uuid, entry_type_param text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(total_supply)::integer, 0)
  FROM public.fanz_tokens
  WHERE (
    (entry_type_param = 'wiki' AND wiki_entry_id = entry_id_param) OR
    (entry_type_param = 'post' AND post_id = entry_id_param)
  )
  AND is_active = true;
$function$;

-- Wiki Entry의 trending_score 계산 함수 업데이트 (Fanz Token 포함)
CREATE OR REPLACE FUNCTION public.update_wiki_trending_score()
RETURNS TRIGGER AS $$
DECLARE
  badge_score INTEGER;
  fanz_token_score INTEGER;
BEGIN
  -- Calculate badge score
  badge_score := public.calculate_wiki_badge_score(NEW.id);
  
  -- Calculate fanz token score
  fanz_token_score := public.calculate_fanz_token_score(NEW.id, 'wiki');
  
  -- Calculate trending score with weights
  -- Fanz Token: 가중치 20 (badge와 동일)
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 10) +                 -- 투표: 가중치 10
    (COALESCE(NEW.view_count, 0) * 1) +             -- 조회수: 가중치 1
    (COALESCE(NEW.likes_count, 0) * 5) +            -- 좋아요: 가중치 5
    (COALESCE(NEW.follower_count, 0) * 3) +         -- 팔로워: 가중치 3
    (badge_score * 20) +                             -- 뱃지: 가중치 20
    (fanz_token_score * 20);                         -- Fanz Token: 가중치 20
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 모든 wiki entries의 trending_score 재계산 (Fanz Token 포함)
UPDATE public.wiki_entries
SET trending_score = 
  (COALESCE(votes, 0) * 10) +
  (COALESCE(view_count, 0) * 1) +
  (COALESCE(likes_count, 0) * 5) +
  (COALESCE(follower_count, 0) * 3) +
  (public.calculate_wiki_badge_score(id) * 20) +
  (public.calculate_fanz_token_score(id, 'wiki') * 20);

-- Post의 trending_score 계산 함수 생성 (Fanz Token 포함)
CREATE OR REPLACE FUNCTION public.update_post_trending_score()
RETURNS TRIGGER AS $$
DECLARE
  fanz_token_score INTEGER;
BEGIN
  -- Calculate fanz token score
  fanz_token_score := public.calculate_fanz_token_score(NEW.id, 'post');
  
  -- Calculate trending score with weights
  -- Fanz Token: 가중치 20
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 10) +                 -- 투표: 가중치 10
    (COALESCE(NEW.view_count, 0) * 1) +             -- 조회수: 가중치 1
    (fanz_token_score * 20);                         -- Fanz Token: 가중치 20
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Post trending_score 업데이트 트리거
DROP TRIGGER IF EXISTS post_trending_score_update_trigger ON public.posts;
CREATE TRIGGER post_trending_score_update_trigger
  BEFORE INSERT OR UPDATE OF votes, view_count ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_trending_score();

-- 모든 posts의 trending_score 초기 계산
UPDATE public.posts
SET trending_score = 
  (COALESCE(votes, 0) * 10) +
  (COALESCE(view_count, 0) * 1) +
  (public.calculate_fanz_token_score(id, 'post') * 20);

-- Fanz Token 변경 시 관련 엔트리/포스트의 trending_score 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_trending_score_on_fanz_token_change()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
  target_type TEXT;
BEGIN
  -- 변경된 토큰의 대상 확인
  target_id := COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id, NEW.post_id, OLD.post_id);
  
  IF COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id) IS NOT NULL THEN
    target_type := 'wiki';
    -- Wiki Entry의 trending_score 업데이트
    UPDATE public.wiki_entries
    SET trending_score = 
      (COALESCE(votes, 0) * 10) +
      (COALESCE(view_count, 0) * 1) +
      (COALESCE(likes_count, 0) * 5) +
      (COALESCE(follower_count, 0) * 3) +
      (public.calculate_wiki_badge_score(id) * 20) +
      (public.calculate_fanz_token_score(id, 'wiki') * 20)
    WHERE id = target_id;
  ELSIF COALESCE(NEW.post_id, OLD.post_id) IS NOT NULL THEN
    target_type := 'post';
    -- Post의 trending_score 업데이트
    UPDATE public.posts
    SET trending_score = 
      (COALESCE(votes, 0) * 10) +
      (COALESCE(view_count, 0) * 1) +
      (public.calculate_fanz_token_score(id, 'post') * 20)
    WHERE id = target_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fanz Token 변경 트리거
DROP TRIGGER IF EXISTS fanz_token_trending_score_update_trigger ON public.fanz_tokens;
CREATE TRIGGER fanz_token_trending_score_update_trigger
  AFTER INSERT OR UPDATE OF total_supply OR DELETE ON public.fanz_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trending_score_on_fanz_token_change();

-- aggregated_scores 계산 함수 업데이트 (Fanz Token 포함)
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

-- 기존 모든 엔트리의 aggregated_scores 재계산
DO $$
DECLARE
  entry_record RECORD;
BEGIN
  FOR entry_record IN SELECT id FROM wiki_entries LOOP
    PERFORM calculate_aggregated_scores(entry_record.id);
  END LOOP;
END $$;