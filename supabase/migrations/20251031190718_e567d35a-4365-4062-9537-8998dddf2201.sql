-- Create vote type enum
CREATE TYPE vote_type AS ENUM ('up', 'down');

-- Create post_votes table to track individual user votes
CREATE TABLE public.post_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_votes
CREATE POLICY "Anyone can view post votes"
  ON public.post_votes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own votes"
  ON public.post_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.post_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.post_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to calculate post votes
CREATE OR REPLACE FUNCTION public.calculate_post_votes(post_id_param UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE -1 END)::INTEGER,
    0
  )
  FROM public.post_votes
  WHERE post_id = post_id_param
$$;

-- Trigger function to update post votes count
CREATE OR REPLACE FUNCTION public.update_post_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.posts
    SET votes = public.calculate_post_votes(NEW.post_id)
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET votes = public.calculate_post_votes(OLD.post_id)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on post_votes
CREATE TRIGGER update_post_votes_on_vote_change
AFTER INSERT OR UPDATE OR DELETE ON public.post_votes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_votes_count();

-- Add index for performance
CREATE INDEX idx_post_votes_post_id ON public.post_votes(post_id);
CREATE INDEX idx_post_votes_user_id ON public.post_votes(user_id);