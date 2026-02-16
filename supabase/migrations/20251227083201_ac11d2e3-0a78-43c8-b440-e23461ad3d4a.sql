-- Wiki Entry trending_score 계산 함수 업데이트
-- votes: 10 → 5, likes_count: 5 → 2, badge_score 제거
CREATE OR REPLACE FUNCTION public.update_wiki_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 5) +
    (COALESCE(NEW.view_count, 0) * 1) +
    (COALESCE(NEW.likes_count, 0) * 2) +
    (COALESCE(NEW.follower_count, 0) * 3) +
    (public.calculate_fanz_token_score(NEW.id, 'wiki') * 20);
  RETURN NEW;
END;
$function$;

-- Fanz Token 변경 시 trending_score 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_trending_score_on_fanz_token_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_id UUID;
  target_type TEXT;
BEGIN
  target_id := COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id, NEW.post_id, OLD.post_id);
  
  IF COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id) IS NOT NULL THEN
    target_type := 'wiki';
    UPDATE public.wiki_entries
    SET trending_score = 
      (COALESCE(votes, 0) * 5) +
      (COALESCE(view_count, 0) * 1) +
      (COALESCE(likes_count, 0) * 2) +
      (COALESCE(follower_count, 0) * 3) +
      (public.calculate_fanz_token_score(id, 'wiki') * 20)
    WHERE id = target_id;
  ELSIF COALESCE(NEW.post_id, OLD.post_id) IS NOT NULL THEN
    target_type := 'post';
    UPDATE public.posts
    SET trending_score = 
      (COALESCE(votes, 0) * 5) +
      (COALESCE(view_count, 0) * 1) +
      (public.calculate_fanz_token_score(id, 'post') * 20)
    WHERE id = target_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 뱃지 관련 함수도 업데이트 (badge_score 제거)
CREATE OR REPLACE FUNCTION public.update_wiki_score_on_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.wiki_entries
  SET trending_score = 
    (COALESCE(votes, 0) * 5) +
    (COALESCE(view_count, 0) * 1) +
    (COALESCE(likes_count, 0) * 2) +
    (COALESCE(follower_count, 0) * 3) +
    (public.calculate_fanz_token_score(COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id), 'wiki') * 20)
  WHERE id = COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Post trending_score 계산 함수 업데이트 (votes: 8 → 5)
CREATE OR REPLACE FUNCTION public.calculate_post_trending_score(post_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    (COALESCE(votes, 0) * 5) +
    (COALESCE(view_count, 0)) +
    ((SELECT COUNT(*)::integer FROM comments WHERE post_id = post_id_param) * 5)
  )
  FROM posts
  WHERE id = post_id_param;
$function$;