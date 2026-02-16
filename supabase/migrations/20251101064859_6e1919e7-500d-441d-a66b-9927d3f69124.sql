-- Function to get point value from point_rules table
CREATE OR REPLACE FUNCTION public.get_point_value(action_type_param text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(points, 0)
  FROM public.point_rules
  WHERE action_type = action_type_param AND is_active = true
  LIMIT 1;
$$;

-- Function to award points to a user
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  points_to_award integer;
BEGIN
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
    VALUES (user_id_param, action_type_param, points_to_award, reference_id_param);
  END IF;
END;
$$;

-- Trigger function for post creation
CREATE OR REPLACE FUNCTION public.award_points_on_post_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Award points for creating a post
  PERFORM public.award_points(NEW.user_id, 'create_post', NEW.id);
  
  -- Check if this is user's first post in this community
  IF NEW.community_id IS NOT NULL THEN
    -- Check if user has other posts in this community
    IF NOT EXISTS (
      SELECT 1 FROM public.posts
      WHERE user_id = NEW.user_id
        AND community_id = NEW.community_id
        AND id != NEW.id
    ) THEN
      -- Award first post in community bonus
      PERFORM public.award_points(NEW.user_id, 'first_post_in_community', NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for receiving upvote
CREATE OR REPLACE FUNCTION public.award_points_on_upvote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Only award points for upvotes, not downvotes
  IF NEW.vote_type = 'up' THEN
    -- Get the post author
    SELECT user_id INTO post_author_id
    FROM public.posts
    WHERE id = NEW.post_id;
    
    -- Award points to post author (not the voter)
    IF post_author_id IS NOT NULL THEN
      PERFORM public.award_points(post_author_id, 'receive_upvote', NEW.post_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for comment creation
CREATE OR REPLACE FUNCTION public.award_points_on_comment_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Award points for writing a comment
  PERFORM public.award_points(NEW.user_id, 'write_comment', NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER award_points_on_post_create_trigger
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_post_create();

CREATE TRIGGER award_points_on_upvote_trigger
AFTER INSERT ON public.post_votes
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_upvote();

CREATE TRIGGER award_points_on_comment_create_trigger
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_comment_create();