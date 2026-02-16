-- Make post_id nullable in comments table since comments can be on either posts or wiki entries
ALTER TABLE public.comments 
ALTER COLUMN post_id DROP NOT NULL;

-- Add check constraint to ensure at least one of post_id or wiki_entry_id is set
ALTER TABLE public.comments 
ADD CONSTRAINT comments_post_or_wiki_check 
CHECK (
  (post_id IS NOT NULL AND wiki_entry_id IS NULL) OR 
  (post_id IS NULL AND wiki_entry_id IS NOT NULL)
);