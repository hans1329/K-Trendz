-- Add wiki_entry_id column to posts table to allow posts in wiki entries
ALTER TABLE public.posts
ADD COLUMN wiki_entry_id uuid REFERENCES public.wiki_entries(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_posts_wiki_entry_id ON public.posts(wiki_entry_id);

-- Add constraint to ensure post belongs to either community or wiki entry, not both
ALTER TABLE public.posts
ADD CONSTRAINT posts_single_parent_check 
CHECK (
  (community_id IS NOT NULL AND wiki_entry_id IS NULL) OR
  (community_id IS NULL AND wiki_entry_id IS NOT NULL) OR
  (community_id IS NULL AND wiki_entry_id IS NULL)
);