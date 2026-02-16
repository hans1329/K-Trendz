-- Add wiki_entry_id to comments table to support comments on wiki entries
ALTER TABLE public.comments 
ADD COLUMN wiki_entry_id uuid REFERENCES public.wiki_entries(id) ON DELETE CASCADE;

-- Add check constraint to ensure either post_id or wiki_entry_id is set (but not both)
ALTER TABLE public.comments 
ADD CONSTRAINT comments_reference_check 
CHECK (
  (post_id IS NOT NULL AND wiki_entry_id IS NULL) OR 
  (post_id IS NULL AND wiki_entry_id IS NOT NULL)
);

-- Create index for wiki entry comments
CREATE INDEX idx_comments_wiki_entry_id ON public.comments(wiki_entry_id);

-- Update RLS policies to allow comments on wiki entries
DROP POLICY IF EXISTS "Users can create their own comments" ON public.comments;
CREATE POLICY "Users can create their own comments" 
ON public.comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create a function to get comment count for wiki entries
CREATE OR REPLACE FUNCTION get_wiki_entry_comment_count(entry_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM comments
  WHERE wiki_entry_id = entry_id;
$$;