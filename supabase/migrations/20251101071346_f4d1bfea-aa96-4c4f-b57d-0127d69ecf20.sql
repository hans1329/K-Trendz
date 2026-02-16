-- Add pin and boost columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_boosted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS boosted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS boosted_until timestamp with time zone;

-- Add index for querying pinned and boosted posts
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts(is_pinned, pinned_at DESC) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_posts_boosted ON public.posts(is_boosted, boosted_until DESC) WHERE is_boosted = true;

-- Function to pin a post (costs points)
CREATE OR REPLACE FUNCTION public.pin_post(post_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
  points_deducted boolean;
BEGIN
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Check if user is the post author
  IF post_author_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only pin your own posts';
  END IF;
  
  -- Check if post is already pinned
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = post_id_param AND is_pinned = true) THEN
    RAISE EXCEPTION 'Post is already pinned';
  END IF;
  
  -- Deduct points
  points_deducted := public.deduct_points(post_author_id, 'pin_post', post_id_param);
  
  IF NOT points_deducted THEN
    RETURN false;
  END IF;
  
  -- Pin the post
  UPDATE public.posts
  SET 
    is_pinned = true,
    pinned_at = now(),
    pinned_by = auth.uid()
  WHERE id = post_id_param;
  
  RETURN true;
END;
$$;

-- Function to unpin a post (no refund)
CREATE OR REPLACE FUNCTION public.unpin_post(post_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Check if user is the post author
  IF post_author_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only unpin your own posts';
  END IF;
  
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

-- Function to boost a post (costs points based on duration)
CREATE OR REPLACE FUNCTION public.boost_post(post_id_param uuid, duration_days integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
  points_deducted boolean;
  action_type_name text;
BEGIN
  -- Validate duration
  IF duration_days NOT IN (1, 3, 7) THEN
    RAISE EXCEPTION 'Invalid duration. Must be 1, 3, or 7 days';
  END IF;
  
  -- Get post author
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = post_id_param;
  
  -- Check if user is the post author
  IF post_author_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only boost your own posts';
  END IF;
  
  -- Determine action type based on duration
  action_type_name := 'boost_post_' || duration_days || 'day';
  IF duration_days > 1 THEN
    action_type_name := action_type_name || 's';
  END IF;
  
  -- Deduct points
  points_deducted := public.deduct_points(post_author_id, action_type_name, post_id_param);
  
  IF NOT points_deducted THEN
    RETURN false;
  END IF;
  
  -- Boost the post
  UPDATE public.posts
  SET 
    is_boosted = true,
    boosted_at = now(),
    boosted_until = now() + (duration_days || ' days')::interval
  WHERE id = post_id_param;
  
  RETURN true;
END;
$$;

-- Function to check and expire boosted posts
CREATE OR REPLACE FUNCTION public.expire_boosted_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET 
    is_boosted = false,
    boosted_at = null,
    boosted_until = null
  WHERE is_boosted = true 
    AND boosted_until < now();
END;
$$;