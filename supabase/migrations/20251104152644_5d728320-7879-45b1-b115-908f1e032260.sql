-- Create wiki_entry_followers table for Fan Up feature
CREATE TABLE public.wiki_entry_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wiki_entry_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, wiki_entry_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entry_followers ENABLE ROW LEVEL SECURITY;

-- RLS policies for wiki_entry_followers
CREATE POLICY "Authenticated users can follow wiki entries"
ON public.wiki_entry_followers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow wiki entries"
ON public.wiki_entry_followers
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Wiki entry followers are viewable by everyone"
ON public.wiki_entry_followers
FOR SELECT
USING (true);

-- Add follower_count to wiki_entries
ALTER TABLE public.wiki_entries
ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;

-- Create trigger function to update follower count
CREATE OR REPLACE FUNCTION public.update_wiki_entry_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wiki_entries
    SET follower_count = follower_count + 1
    WHERE id = NEW.wiki_entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wiki_entries
    SET follower_count = follower_count - 1
    WHERE id = OLD.wiki_entry_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger
CREATE TRIGGER update_wiki_entry_follower_count_trigger
AFTER INSERT OR DELETE ON public.wiki_entry_followers
FOR EACH ROW
EXECUTE FUNCTION public.update_wiki_entry_follower_count();