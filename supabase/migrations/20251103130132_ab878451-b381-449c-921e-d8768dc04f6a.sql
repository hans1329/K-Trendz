-- Create wiki_gallery table for fan-uploaded media
CREATE TABLE public.wiki_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wiki_gallery ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Gallery items are viewable by everyone"
ON public.wiki_gallery
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can upload media"
ON public.wiki_gallery
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
ON public.wiki_gallery
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_wiki_gallery_wiki_entry_id ON public.wiki_gallery(wiki_entry_id);
CREATE INDEX idx_wiki_gallery_created_at ON public.wiki_gallery(created_at DESC);