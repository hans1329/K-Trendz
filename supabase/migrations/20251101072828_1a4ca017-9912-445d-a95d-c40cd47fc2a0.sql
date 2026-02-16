-- Update pin_post to admin-only and remove point cost
DROP FUNCTION IF EXISTS public.pin_post(uuid);

CREATE OR REPLACE FUNCTION public.pin_post(post_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
  is_user_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_user_admin;
  
  IF NOT is_user_admin THEN
    RAISE EXCEPTION 'Only admins can pin posts';
  END IF;
  
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Check if post is already pinned
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = post_id_param AND is_pinned = true) THEN
    RAISE EXCEPTION 'Post is already pinned';
  END IF;
  
  -- Pin the post (no point cost)
  UPDATE public.posts
  SET 
    is_pinned = true,
    pinned_at = now(),
    pinned_by = auth.uid()
  WHERE id = post_id_param;
  
  RETURN true;
END;
$$;

-- Update unpin_post to admin-only
DROP FUNCTION IF EXISTS public.unpin_post(uuid);

CREATE OR REPLACE FUNCTION public.unpin_post(post_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
  is_user_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_user_admin;
  
  IF NOT is_user_admin THEN
    RAISE EXCEPTION 'Only admins can unpin posts';
  END IF;
  
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Unpin the post
  UPDATE public.posts
  SET 
    is_pinned = false,
    pinned_at = null,
    pinned_by = null
  WHERE id = post_id_param;
  
  RETURN true;
END;
$$;

-- Update boost_post max duration to 72 hours
DROP FUNCTION IF EXISTS public.boost_post(uuid, integer);

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

-- Remove pin_post from point_rules since it's free for admins
DELETE FROM public.point_rules WHERE action_type = 'pin_post';