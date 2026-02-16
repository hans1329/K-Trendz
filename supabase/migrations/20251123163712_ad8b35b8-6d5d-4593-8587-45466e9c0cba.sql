-- Fix check_and_increment_vote_count to allow 13th vote and track first vote of the day per target
CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(
  user_id_param uuid,
  target_id_param uuid DEFAULT NULL,
  target_type_param text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  max_votes INTEGER;
  can_vote BOOLEAN;
  remaining_votes INTEGER;
  completion_rewarded BOOLEAN := false;
  user_level INTEGER;
  is_first_vote_today BOOLEAN := false;
  should_deduct_energy BOOLEAN := true;
BEGIN
  -- Get user's current level
  SELECT current_level INTO user_level
  FROM profiles
  WHERE id = user_id_param;
  
  IF user_level IS NULL THEN
    user_level := 1;
  END IF;
  
  -- Get max votes for user's level
  SELECT max_daily_votes INTO max_votes
  FROM levels
  WHERE id = user_level;
  
  IF max_votes IS NULL THEN
    max_votes := 13; -- Fallback default
  END IF;
  
  -- Get or create today's vote count
  INSERT INTO public.daily_vote_counts (user_id, vote_count, vote_date)
  VALUES (user_id_param, 0, CURRENT_DATE)
  ON CONFLICT (user_id, vote_date) 
  DO NOTHING;
  
  -- Get current count
  SELECT vote_count INTO current_count
  FROM public.daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
  
  -- Check if user has voted on this target today (if target provided)
  IF target_id_param IS NOT NULL AND target_type_param IS NOT NULL THEN
    IF target_type_param = 'post' THEN
      -- Check if voted on this post today
      is_first_vote_today := NOT EXISTS (
        SELECT 1 FROM public.post_votes
        WHERE user_id = user_id_param 
          AND post_id = target_id_param
          AND DATE(created_at) = CURRENT_DATE
      );
    ELSIF target_type_param = 'wiki_entry' THEN
      -- Check if voted on this wiki entry today
      is_first_vote_today := NOT EXISTS (
        SELECT 1 FROM public.wiki_entry_votes
        WHERE user_id = user_id_param 
          AND wiki_entry_id = target_id_param
          AND DATE(created_at) = CURRENT_DATE
      );
    END IF;
    
    -- Only deduct energy if it's the first vote on this target today
    should_deduct_energy := is_first_vote_today;
  END IF;
  
  -- Check if can vote (allow up to max_votes, inclusive)
  can_vote := current_count < max_votes AND should_deduct_energy;
  
  IF can_vote THEN
    -- Increment vote count
    UPDATE public.daily_vote_counts
    SET vote_count = vote_count + 1, updated_at = now()
    WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
    
    current_count := current_count + 1;
    
    -- Check if completed all votes for the first time today
    IF current_count = max_votes THEN
      -- Check if already rewarded today
      IF NOT EXISTS (
        SELECT 1 FROM public.point_transactions
        WHERE user_id = user_id_param
          AND action_type = 'daily_vote_completion'
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        -- Award completion bonus
        PERFORM public.award_points(user_id_param, 'daily_vote_completion', NULL);
        completion_rewarded := true;
      END IF;
    END IF;
  END IF;
  
  remaining_votes := GREATEST(max_votes - current_count, 0);
  
  RETURN jsonb_build_object(
    'can_vote', can_vote,
    'current_count', current_count,
    'max_votes', max_votes,
    'remaining_votes', remaining_votes,
    'completion_rewarded', completion_rewarded,
    'should_deduct_energy', should_deduct_energy,
    'is_first_vote_today', is_first_vote_today
  );
END;
$function$;