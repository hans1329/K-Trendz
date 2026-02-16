
-- 1. award_points 함수 UUID 버전 수정 (bypass 플래그 추가)
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
  
  -- Get point value from rules
  points_to_award := public.get_point_value(action_type_param);
  
  -- Only proceed if points > 0
  IF points_to_award > 0 THEN
    -- Update user's points
    UPDATE public.profiles
    SET 
      available_points = available_points + points_to_award,
      total_points = total_points + points_to_award
    WHERE id = user_id_param;
    
    -- Record transaction
    INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
    VALUES (user_id_param, action_type_param, points_to_award, reference_id_param::text);
  END IF;
END;
$$;

-- 2. boost_post 함수 수정 (bypass 플래그 추가)
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

  -- Validate duration (1 hour to 72 hours / 3 days MAX)
  IF duration_hours < 1 OR duration_hours > 72 THEN
    RAISE EXCEPTION 'Invalid duration. Must be between 1 and 72 hours';
  END IF;
  
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Check if user is the post author
  IF post_author_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only boost your own posts';
  END IF;
  
  -- Get hourly cost
  SELECT points INTO hourly_cost
  FROM public.point_rules
  WHERE action_type = 'boost_post_per_hour' AND is_active = true;
  
  IF hourly_cost IS NULL THEN
    hourly_cost := -5; -- Default fallback
  END IF;
  
  -- Calculate total cost
  total_cost := hourly_cost * duration_hours;
  
  -- Check if user has enough points
  SELECT available_points INTO current_available_points
  FROM public.profiles
  WHERE id = post_author_id;
  
  IF current_available_points + total_cost < 0 THEN
    RAISE EXCEPTION 'Insufficient points to boost post';
  END IF;
  
  -- Deduct points
  UPDATE public.profiles
  SET available_points = available_points + total_cost
  WHERE id = post_author_id;
  
  -- Record transaction
  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (post_author_id, 'boost_post_per_hour', total_cost, post_id_param::text);
  
  -- Boost the post
  UPDATE public.posts
  SET 
    is_boosted = true,
    boosted_at = now(),
    boosted_until = now() + (duration_hours || ' hours')::interval
  WHERE id = post_id_param;
  
  RETURN true;
END;
$$;
