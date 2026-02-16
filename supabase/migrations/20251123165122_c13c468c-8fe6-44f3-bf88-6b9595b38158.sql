-- Adjust check_and_increment_vote_count logic so 13th vote is allowed
CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(
  user_id_param uuid,
  target_id_param uuid DEFAULT NULL,
  target_type_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  max_votes integer;
  completion_rewarded boolean := false;
  is_first_vote_today boolean := true;
  should_deduct_energy boolean := true;
  can_vote_now boolean;
BEGIN
  -- Get max votes for user's current level with safe fallbacks
  SELECT COALESCE(l.max_daily_votes, 13) INTO max_votes
  FROM public.profiles p
  LEFT JOIN public.levels l ON p.current_level = l.id
  WHERE p.id = user_id_param;

  IF max_votes IS NULL THEN
    max_votes := 13;
  END IF;

  -- Get or create today's vote count
  INSERT INTO public.daily_vote_counts (user_id, vote_date, vote_count)
  VALUES (user_id_param, CURRENT_DATE, 0)
  ON CONFLICT (user_id, vote_date)
  DO NOTHING;

  SELECT vote_count INTO current_count
  FROM public.daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;

  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  -- Check if completion reward has been given today already
  SELECT EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE user_id = user_id_param
      AND action_type = 'daily_vote_completion'
      AND DATE(created_at) = CURRENT_DATE
  ) INTO completion_rewarded;

  -- Check if this is first vote on this target today (to determine energy deduction)
  IF target_id_param IS NOT NULL AND target_type_param IS NOT NULL THEN
    IF target_type_param = 'post' THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.post_votes
        WHERE user_id = user_id_param
          AND post_id = target_id_param
          AND DATE(created_at) = CURRENT_DATE
      ) INTO is_first_vote_today;
    ELSIF target_type_param = 'wiki_entry' THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.wiki_entry_votes
        WHERE user_id = user_id_param
          AND wiki_entry_id = target_id_param
          AND DATE(created_at) = CURRENT_DATE
      ) INTO is_first_vote_today;
    END IF;
  END IF;

  should_deduct_energy := is_first_vote_today;

  -- Decide if this call can consume one daily vote (before increment)
  can_vote_now := (current_count < max_votes) AND should_deduct_energy;

  -- Increment vote count only if under limit and should deduct energy
  IF can_vote_now THEN
    UPDATE public.daily_vote_counts
    SET vote_count = vote_count + 1, updated_at = now()
    WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;

    current_count := current_count + 1;

    -- If this increment just reached the daily max, award completion bonus once
    IF (current_count = max_votes) AND NOT completion_rewarded THEN
      PERFORM public.award_points(user_id_param, 'daily_vote_completion', NULL);
      completion_rewarded := true;
    END IF;
  END IF;

  RETURN json_build_object(
    'can_vote', can_vote_now,
    'current_count', current_count,
    'max_votes', max_votes,
    'remaining_votes', GREATEST(0, max_votes - current_count),
    'completion_rewarded', completion_rewarded,
    'should_deduct_energy', should_deduct_energy,
    'is_first_vote_today', is_first_vote_today
  );
END;
$$;