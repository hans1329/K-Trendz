-- Drop and recreate check_and_increment_vote_count to properly handle 'post' target_type
DROP FUNCTION IF EXISTS public.check_and_increment_vote_count(uuid, uuid, text);

CREATE FUNCTION public.check_and_increment_vote_count(
  user_id_param UUID,
  target_id_param UUID,
  target_type_param TEXT DEFAULT 'wiki_entry'
)
RETURNS TABLE(success BOOLEAN, remaining_votes INTEGER, is_first_vote_today BOOLEAN) AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  user_level INTEGER;
  max_votes INTEGER;
  current_votes INTEGER;
  vote_exists BOOLEAN;
BEGIN
  -- Get user's current level
  SELECT current_level INTO user_level FROM profiles WHERE id = user_id_param;
  IF user_level IS NULL THEN
    user_level := 1;
  END IF;
  
  -- Get max daily votes for user's level
  SELECT l.max_daily_votes INTO max_votes FROM levels l WHERE l.id = user_level;
  IF max_votes IS NULL THEN
    max_votes := 3;
  END IF;
  
  -- Get current vote count for today
  SELECT vote_count INTO current_votes 
  FROM daily_vote_counts 
  WHERE user_id = user_id_param AND vote_date = today_date;
  
  IF current_votes IS NULL THEN
    current_votes := 0;
  END IF;
  
  -- Check if already voted on this target today
  IF target_type_param = 'wiki_entry' THEN
    SELECT EXISTS(
      SELECT 1 FROM wiki_entry_votes 
      WHERE user_id = user_id_param 
        AND wiki_entry_id = target_id_param 
        AND DATE(created_at) = today_date
    ) INTO vote_exists;
  ELSIF target_type_param = 'post' THEN
    SELECT EXISTS(
      SELECT 1 FROM post_votes 
      WHERE user_id = user_id_param 
        AND post_id = target_id_param 
        AND DATE(created_at) = today_date
    ) INTO vote_exists;
  ELSE
    vote_exists := FALSE;
  END IF;
  
  -- Already voted on this target today
  IF vote_exists THEN
    RETURN QUERY SELECT FALSE, max_votes - current_votes, FALSE;
    RETURN;
  END IF;
  
  -- Check if user has remaining votes
  IF current_votes >= max_votes THEN
    RETURN QUERY SELECT FALSE, 0, FALSE;
    RETURN;
  END IF;
  
  -- Increment vote count
  INSERT INTO daily_vote_counts (user_id, vote_date, vote_count)
  VALUES (user_id_param, today_date, 1)
  ON CONFLICT (user_id, vote_date) 
  DO UPDATE SET vote_count = daily_vote_counts.vote_count + 1, updated_at = NOW();
  
  -- Record point transaction for voting (1 point per vote)
  INSERT INTO point_transactions (user_id, action_type, points, reference_id)
  VALUES (user_id_param, 'vote', 1, target_id_param);
  
  -- Update user's available points
  UPDATE profiles 
  SET available_points = available_points + 1,
      total_points = total_points + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
  
  RETURN QUERY SELECT TRUE, max_votes - current_votes - 1, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;