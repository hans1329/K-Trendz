-- Update trigger function to prevent self-voting from awarding points
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
    
    -- Award points to post author ONLY if the voter is NOT the author
    IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
      PERFORM public.award_points(post_author_id, 'receive_upvote', NEW.post_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;