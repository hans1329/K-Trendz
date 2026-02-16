-- Create wiki entry user contributions table
CREATE TABLE IF NOT EXISTS public.wiki_entry_user_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  votes_received INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, user_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entry_user_contributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Contributions are viewable by everyone"
  ON public.wiki_entry_user_contributions
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert contributions"
  ON public.wiki_entry_user_contributions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update contributions"
  ON public.wiki_entry_user_contributions
  FOR UPDATE
  USING (true);

-- Create index for performance
CREATE INDEX idx_wiki_entry_contributions_entry_score ON public.wiki_entry_user_contributions(wiki_entry_id, contribution_score DESC);
CREATE INDEX idx_wiki_entry_contributions_user ON public.wiki_entry_user_contributions(user_id);

-- Function to update contribution score
CREATE OR REPLACE FUNCTION public.update_wiki_entry_contribution_score(
  entry_id_param UUID,
  user_id_param UUID,
  score_delta INTEGER,
  posts_delta INTEGER DEFAULT 0,
  comments_delta INTEGER DEFAULT 0,
  votes_delta INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wiki_entry_user_contributions (
    wiki_entry_id,
    user_id,
    contribution_score,
    posts_count,
    comments_count,
    votes_received
  )
  VALUES (
    entry_id_param,
    user_id_param,
    score_delta,
    posts_delta,
    comments_delta,
    votes_delta
  )
  ON CONFLICT (wiki_entry_id, user_id)
  DO UPDATE SET
    contribution_score = wiki_entry_user_contributions.contribution_score + score_delta,
    posts_count = wiki_entry_user_contributions.posts_count + posts_delta,
    comments_count = wiki_entry_user_contributions.comments_count + comments_delta,
    votes_received = wiki_entry_user_contributions.votes_received + votes_delta,
    updated_at = now();
END;
$$;

-- Trigger to update contributions on post creation
CREATE OR REPLACE FUNCTION public.update_contribution_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.wiki_entry_id IS NOT NULL THEN
    PERFORM public.update_wiki_entry_contribution_score(
      NEW.wiki_entry_id,
      NEW.user_id,
      10, -- 10 points for creating a post
      1,  -- increment posts_count
      0,
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_contribution_on_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contribution_on_post();

-- Trigger to update contributions on comment creation
CREATE OR REPLACE FUNCTION public.update_contribution_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.wiki_entry_id IS NOT NULL THEN
    PERFORM public.update_wiki_entry_contribution_score(
      NEW.wiki_entry_id,
      NEW.user_id,
      5, -- 5 points for creating a comment
      0,
      1, -- increment comments_count
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_contribution_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contribution_on_comment();

-- Trigger to update contributions on receiving votes
CREATE OR REPLACE FUNCTION public.update_contribution_on_post_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id UUID;
  post_entry_id UUID;
BEGIN
  IF NEW.vote_type = 'up' THEN
    -- Get post author and wiki_entry_id
    SELECT user_id, wiki_entry_id INTO post_author_id, post_entry_id
    FROM public.posts
    WHERE id = NEW.post_id;
    
    -- Update contribution if post is linked to wiki entry
    IF post_entry_id IS NOT NULL AND post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
      PERFORM public.update_wiki_entry_contribution_score(
        post_entry_id,
        post_author_id,
        3, -- 3 points for receiving an upvote
        0,
        0,
        1  -- increment votes_received
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_contribution_on_post_vote
  AFTER INSERT ON public.post_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contribution_on_post_vote();