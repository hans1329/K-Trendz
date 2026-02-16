-- Create function to calculate post trending score
CREATE OR REPLACE FUNCTION public.calculate_post_trending_score(post_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    (COALESCE(votes, 0) * 10) +
    (COALESCE(view_count, 0)) +
    ((SELECT COUNT(*)::integer FROM comments WHERE post_id = post_id_param) * 5)
  )
  FROM posts
  WHERE id = post_id_param;
$$;

-- Create function to update post trending score
CREATE OR REPLACE FUNCTION public.update_post_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calculate trending score with weights
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 10) +           -- 투표: 가중치 10
    (COALESCE(NEW.view_count, 0)) +           -- 조회수: 가중치 1
    ((SELECT COUNT(*)::integer FROM comments WHERE post_id = NEW.id) * 5);  -- 댓글: 가중치 5
  
  RETURN NEW;
END;
$$;

-- Create trigger to update trending score on post update
DROP TRIGGER IF EXISTS trigger_update_post_trending_score ON posts;
CREATE TRIGGER trigger_update_post_trending_score
  BEFORE UPDATE ON posts
  FOR EACH ROW
  WHEN (
    OLD.votes IS DISTINCT FROM NEW.votes OR
    OLD.view_count IS DISTINCT FROM NEW.view_count
  )
  EXECUTE FUNCTION update_post_trending_score();

-- Create trigger to update post trending score when comments change
CREATE OR REPLACE FUNCTION public.update_post_score_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_post_id uuid;
BEGIN
  -- Get the post_id from either NEW or OLD
  IF TG_OP = 'DELETE' THEN
    target_post_id := OLD.post_id;
  ELSE
    target_post_id := NEW.post_id;
  END IF;
  
  -- Only update if it's a post comment
  IF target_post_id IS NOT NULL THEN
    UPDATE posts
    SET trending_score = public.calculate_post_trending_score(target_post_id)
    WHERE id = target_post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_post_score_on_comment ON comments;
CREATE TRIGGER trigger_update_post_score_on_comment
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_score_on_comment();