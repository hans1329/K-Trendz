-- Align check_and_increment_vote_count return shape with frontend expectations
DROP FUNCTION IF EXISTS public.check_and_increment_vote_count(uuid, uuid, text);

CREATE FUNCTION public.check_and_increment_vote_count(
  user_id_param UUID,
  target_id_param UUID,
  target_type_param TEXT DEFAULT 'wiki_entry'
)
RETURNS TABLE(
  can_vote BOOLEAN,
  current_count INTEGER,
  max_votes INTEGER,
  remaining_votes INTEGER,
  completion_rewarded BOOLEAN,
  should_deduct_energy BOOLEAN,
  is_first_vote_today BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  user_level INTEGER;
  max_votes_local INTEGER;
  current_votes_local INTEGER;
  vote_exists BOOLEAN;
  new_votes_local INTEGER;
BEGIN
  -- protect_user_points 트리거 우회 (이 함수 내부에서만, 트랜잭션 로컬)
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  -- Get user's current level
  SELECT current_level INTO user_level FROM profiles WHERE id = user_id_param;
  IF user_level IS NULL THEN
    user_level := 1;
  END IF;

  -- Get max daily votes for user's level
  SELECT l.max_daily_votes INTO max_votes_local FROM levels l WHERE l.id = user_level;
  IF max_votes_local IS NULL THEN
    max_votes_local := 3;
  END IF;

  -- Get current vote count for today
  SELECT vote_count INTO current_votes_local
  FROM daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = today_date;

  IF current_votes_local IS NULL THEN
    current_votes_local := 0;
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

  -- Duplicate vote on same target today
  IF vote_exists THEN
    RETURN QUERY SELECT
      TRUE,
      current_votes_local,
      max_votes_local,
      GREATEST(max_votes_local - current_votes_local, 0),
      FALSE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  -- Daily limit reached
  IF current_votes_local >= max_votes_local THEN
    RETURN QUERY SELECT
      FALSE,
      current_votes_local,
      max_votes_local,
      0,
      FALSE,
      FALSE,
      TRUE;
    RETURN;
  END IF;

  -- Increment vote count
  INSERT INTO daily_vote_counts (user_id, vote_date, vote_count)
  VALUES (user_id_param, today_date, 1)
  ON CONFLICT (user_id, vote_date)
  DO UPDATE SET vote_count = daily_vote_counts.vote_count + 1, updated_at = NOW();

  new_votes_local := current_votes_local + 1;

  -- Record point transaction for voting (1 point per vote)
  INSERT INTO point_transactions (user_id, action_type, points, reference_id)
  VALUES (user_id_param, 'vote', 1, target_id_param);

  -- Update user's available points
  UPDATE profiles
  SET available_points = available_points + 1,
      total_points = total_points + 1,
      updated_at = NOW()
  WHERE id = user_id_param;

  RETURN QUERY SELECT
    TRUE,
    new_votes_local,
    max_votes_local,
    GREATEST(max_votes_local - new_votes_local, 0),
    (new_votes_local = max_votes_local),
    TRUE,
    TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_vote_count(uuid, uuid, text) TO authenticated;