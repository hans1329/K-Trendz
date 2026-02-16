-- Function to award daily login bonus
CREATE OR REPLACE FUNCTION public.award_daily_login_bonus(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  already_claimed boolean;
BEGIN
  -- Check if user already claimed daily login today
  SELECT EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE user_id = user_id_param
      AND action_type = 'daily_login'
      AND DATE(created_at) = CURRENT_DATE
  ) INTO already_claimed;
  
  -- If not claimed yet, award points
  IF NOT already_claimed THEN
    PERFORM public.award_points(user_id_param, 'daily_login', NULL);
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to check and award trending bonus
CREATE OR REPLACE FUNCTION public.check_and_award_trending_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trending_threshold integer := 50; -- 50 업보트 이상이면 트렌딩
  post_author_id uuid;
  already_awarded boolean;
BEGIN
  -- Only check when post reaches trending threshold
  IF NEW.votes >= trending_threshold AND (OLD.votes IS NULL OR OLD.votes < trending_threshold) THEN
    -- Get post author
    SELECT user_id INTO post_author_id
    FROM public.posts
    WHERE id = NEW.id;
    
    -- Check if trending bonus already awarded for this post
    SELECT EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = post_author_id
        AND action_type = 'post_trending'
        AND reference_id = NEW.id
    ) INTO already_awarded;
    
    -- Award points if not already awarded
    IF NOT already_awarded AND post_author_id IS NOT NULL THEN
      PERFORM public.award_points(post_author_id, 'post_trending', NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for trending bonus on post update
CREATE TRIGGER check_trending_bonus_trigger
AFTER UPDATE OF votes ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_award_trending_bonus();