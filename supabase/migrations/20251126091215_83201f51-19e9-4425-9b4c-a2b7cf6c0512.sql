-- Update wiki entry trending score calculation with new weights
CREATE OR REPLACE FUNCTION public.update_wiki_trending_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  badge_score INTEGER;
  fanz_token_score INTEGER;
BEGIN
  -- Calculate badge score
  badge_score := public.calculate_wiki_badge_score(NEW.id);
  
  -- Calculate fanz token score
  fanz_token_score := public.calculate_fanz_token_score(NEW.id, 'wiki');
  
  -- Calculate trending score with NEW weights
  -- Votes: 8 (changed from 10)
  -- Follower: 10 (changed from 3)
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 8) +                 -- 투표: 가중치 8
    (COALESCE(NEW.view_count, 0) * 1) +            -- 조회수: 가중치 1
    (COALESCE(NEW.likes_count, 0) * 5) +           -- 좋아요: 가중치 5
    (COALESCE(NEW.follower_count, 0) * 10) +       -- 팔로워: 가중치 10
    (badge_score * 20) +                            -- 뱃지: 가중치 20
    (fanz_token_score * 20);                        -- Fanz Token: 가중치 20
  
  RETURN NEW;
END;
$function$;

-- Update post trending score calculation with new weights
CREATE OR REPLACE FUNCTION public.update_post_trending_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fanz_token_score INTEGER;
BEGIN
  -- Calculate fanz token score
  fanz_token_score := public.calculate_fanz_token_score(NEW.id, 'post');
  
  -- Calculate trending score with NEW weights
  -- Votes: 8 (changed from 10)
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 8) +                 -- 투표: 가중치 8
    (COALESCE(NEW.view_count, 0) * 1) +            -- 조회수: 가중치 1
    (fanz_token_score * 20);                        -- Fanz Token: 가중치 20
  
  RETURN NEW;
END;
$function$;