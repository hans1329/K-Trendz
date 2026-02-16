-- Create wiki_entry_rankings table
CREATE TABLE IF NOT EXISTS public.wiki_entry_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  sort_type TEXT NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wiki_entry_rankings ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing rankings
CREATE POLICY "Wiki entry rankings are viewable by everyone"
ON public.wiki_entry_rankings
FOR SELECT
USING (true);

-- Create index for faster queries
CREATE INDEX idx_wiki_entry_rankings_sort_snapshot 
ON public.wiki_entry_rankings(sort_type, snapshot_at DESC);

CREATE INDEX idx_wiki_entry_rankings_entry_sort 
ON public.wiki_entry_rankings(wiki_entry_id, sort_type);