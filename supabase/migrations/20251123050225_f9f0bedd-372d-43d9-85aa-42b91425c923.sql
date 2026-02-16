-- Add max_daily_votes column to levels table
ALTER TABLE levels ADD COLUMN IF NOT EXISTS max_daily_votes INTEGER NOT NULL DEFAULT 13;

-- Set level-specific daily vote limits
UPDATE levels SET max_daily_votes = 13 WHERE id = 1; -- Rookie Fan
UPDATE levels SET max_daily_votes = 15 WHERE id = 2; -- Rising Star
UPDATE levels SET max_daily_votes = 18 WHERE id = 3; -- Dedicated Stan
UPDATE levels SET max_daily_votes = 22 WHERE id = 4; -- Super Fan
UPDATE levels SET max_daily_votes = 30 WHERE id = 5; -- Ultimate Legend

-- Update check_and_increment_vote_count function to use level-based limits
CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count INTEGER;
  max_votes INTEGER;
  can_vote BOOLEAN;
  remaining_votes INTEGER;
  completion_rewarded BOOLEAN := false;
  user_level INTEGER;
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
  
  -- Check if can vote
  can_vote := current_count < max_votes;
  
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
    'completion_rewarded', completion_rewarded
  );
END;
$$;

-- Update get_daily_vote_status function to use level-based limits
CREATE OR REPLACE FUNCTION public.get_daily_vote_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count INTEGER;
  max_votes INTEGER;
  remaining_votes INTEGER;
  user_level INTEGER;
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
  
  -- Get today's vote count
  SELECT COALESCE(vote_count, 0) INTO current_count
  FROM public.daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
  
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;
  
  remaining_votes := GREATEST(max_votes - current_count, 0);
  
  RETURN jsonb_build_object(
    'current_count', current_count,
    'max_votes', max_votes,
    'remaining_votes', remaining_votes,
    'can_vote', current_count < max_votes
  );
END;
$$;