-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_update_post_trending_score ON posts;

-- Recreate the function with better logic
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

-- Create trigger that fires on both INSERT and UPDATE
CREATE TRIGGER trigger_update_post_trending_score
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_trending_score();