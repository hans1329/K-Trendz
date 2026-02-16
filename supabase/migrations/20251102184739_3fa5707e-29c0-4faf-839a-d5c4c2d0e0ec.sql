-- Add likes_count column to wiki_entries
ALTER TABLE wiki_entries 
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- Create wiki_entry_likes table
CREATE TABLE IF NOT EXISTS public.wiki_entry_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, user_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entry_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Wiki entry likes are viewable by everyone" 
ON public.wiki_entry_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can like wiki entries" 
ON public.wiki_entry_likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike wiki entries" 
ON public.wiki_entry_likes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Function to update wiki_entry likes count
CREATE OR REPLACE FUNCTION public.update_wiki_entry_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wiki_entries
    SET likes_count = likes_count + 1
    WHERE id = NEW.wiki_entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wiki_entries
    SET likes_count = likes_count - 1
    WHERE id = OLD.wiki_entry_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update likes count
DROP TRIGGER IF EXISTS update_wiki_entry_likes_count_trigger ON wiki_entry_likes;
CREATE TRIGGER update_wiki_entry_likes_count_trigger
  AFTER INSERT OR DELETE ON wiki_entry_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wiki_entry_likes_count();