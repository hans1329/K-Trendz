
-- Fix reference_id type mismatch (point_transactions.reference_id is UUID)

-- 1) award_points(uuid, text, uuid) should insert UUID reference_id
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_award integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  points_to_award := public.get_point_value(action_type_param);

  IF points_to_award > 0 THEN
    UPDATE public.profiles
    SET
      available_points = available_points + points_to_award,
      total_points = total_points + points_to_award
    WHERE id = user_id_param;

    INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
    VALUES (user_id_param, action_type_param, points_to_award, reference_id_param);
  END IF;
END;
$$;

-- 2) boost_post should insert UUID reference_id
CREATE OR REPLACE FUNCTION public.boost_post(post_id_param uuid, duration_hours integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
  hourly_cost integer;
  total_cost integer;
  current_available_points integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  IF duration_hours < 1 OR duration_hours > 72 THEN
    RAISE EXCEPTION 'Invalid duration. Must be between 1 and 72 hours';
  END IF;

  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;

  IF post_author_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only boost your own posts';
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
  WHERE id = post_author_id;

  IF current_available_points + total_cost < 0 THEN
    RAISE EXCEPTION 'Insufficient points to boost post';
  END IF;

  UPDATE public.profiles
  SET available_points = available_points + total_cost
  WHERE id = post_author_id;

  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (post_author_id, 'boost_post_per_hour', total_cost, post_id_param);

  UPDATE public.posts
  SET
    is_boosted = true,
    boosted_at = now(),
    boosted_until = now() + (duration_hours || ' hours')::interval
  WHERE id = post_id_param;

  RETURN true;
END;
$$;
