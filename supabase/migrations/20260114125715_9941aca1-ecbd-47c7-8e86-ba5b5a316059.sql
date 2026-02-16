
-- deduct_points(uuid, text, uuid) 버전에 bypass 플래그 추가
CREATE OR REPLACE FUNCTION public.deduct_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_deduct integer;
  current_available_points integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  -- Get point value from rules (will be negative)
  points_to_deduct := public.get_point_value(action_type_param);

  -- Get user's current available points
  SELECT available_points INTO current_available_points
  FROM public.profiles
  WHERE id = user_id_param;

  -- Check if user has enough points (points_to_deduct is negative, so we add)
  IF current_available_points + points_to_deduct < 0 THEN
    RETURN false; -- Not enough points
  END IF;

  -- Deduct points (available_points only, total_points stays for XP/level)
  UPDATE public.profiles
  SET available_points = available_points + points_to_deduct
  WHERE id = user_id_param;

  -- Record transaction
  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (user_id_param, action_type_param, points_to_deduct, reference_id_param);

  RETURN true;
END;
$$;

-- boost_wiki_entry 함수에도 bypass 플래그 추가
CREATE OR REPLACE FUNCTION public.boost_wiki_entry(wiki_entry_id_param uuid, duration_hours integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_creator_id uuid;
  hourly_cost integer;
  total_cost integer;
  current_available_points integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  IF duration_hours < 1 OR duration_hours > 72 THEN
    RAISE EXCEPTION 'Invalid duration. Must be between 1 and 72 hours';
  END IF;

  SELECT creator_id INTO entry_creator_id
  FROM public.wiki_entries
  WHERE id = wiki_entry_id_param;

  IF entry_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only boost your own wiki entries';
  END IF;

  SELECT points INTO hourly_cost
  FROM public.point_rules
  WHERE action_type = 'boost_post_per_hour' AND is_active = true;

  IF hourly_cost IS NULL THEN
    hourly_cost := -5;
  END IF;

  total_cost := hourly_cost * duration_hours;

  SELECT available_points INTO current_available_points
  FROM public.profiles
  WHERE id = entry_creator_id;

  IF current_available_points + total_cost < 0 THEN
    RAISE EXCEPTION 'Insufficient points to boost wiki entry';
  END IF;

  UPDATE public.profiles
  SET available_points = available_points + total_cost
  WHERE id = entry_creator_id;

  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (entry_creator_id, 'boost_post_per_hour', total_cost, wiki_entry_id_param);

  UPDATE public.wiki_entries
  SET 
    is_boosted = true,
    boosted_at = now(),
    boosted_until = now() + (duration_hours || ' hours')::interval
  WHERE id = wiki_entry_id_param;

  RETURN true;
END;
$$;
