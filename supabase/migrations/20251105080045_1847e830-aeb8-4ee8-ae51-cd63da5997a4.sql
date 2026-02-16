-- Create wiki_entry_votes table
CREATE TABLE IF NOT EXISTS public.wiki_entry_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, user_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entry_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own wiki entry votes"
  ON public.wiki_entry_votes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wiki entry votes"
  ON public.wiki_entry_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wiki entry votes"
  ON public.wiki_entry_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wiki entry votes"
  ON public.wiki_entry_votes
  FOR DELETE
  USING (auth.uid() = user_id);