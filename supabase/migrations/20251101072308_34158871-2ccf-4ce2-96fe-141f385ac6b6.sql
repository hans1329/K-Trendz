-- Drop existing boost_post function
DROP FUNCTION IF EXISTS public.boost_post(uuid, integer);

-- Delete old day-based boost rules
DELETE FROM public.point_rules WHERE action_type IN ('boost_post_1day', 'boost_post_3days', 'boost_post_7days');

-- Add hourly-based boost rule
INSERT INTO public.point_rules (action_type, category, description, points, is_active)
VALUES ('boost_post_per_hour', 'usage', 'Boost post (cost per hour)', -5, true)
ON CONFLICT (action_type) DO UPDATE SET points = EXCLUDED.points;

-- Create new boost_post function that accepts hours
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
  -- Validate duration (1 hour to 720 hours / 30 days)
  IF duration_hours < 1 OR duration_hours > 720 THEN
    RAISE EXCEPTION 'Invalid duration. Must be between 1 and 720 hours';
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
  VALUES (post_author_id, 'boost_post_per_hour', total_cost, post_id_param);
  
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