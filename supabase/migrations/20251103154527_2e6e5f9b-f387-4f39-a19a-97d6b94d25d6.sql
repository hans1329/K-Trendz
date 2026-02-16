-- Create table for storing post ranking snapshots
CREATE TABLE IF NOT EXISTS public.post_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  sort_type TEXT NOT NULL, -- 'hot', 'top', 'best'
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_post_rankings_post_id ON public.post_rankings(post_id);
CREATE INDEX idx_post_rankings_sort_type_snapshot ON public.post_rankings(sort_type, snapshot_at DESC);
CREATE INDEX idx_post_rankings_post_sort_snapshot ON public.post_rankings(post_id, sort_type, snapshot_at DESC);

-- Enable RLS
ALTER TABLE public.post_rankings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read rankings
CREATE POLICY "Post rankings are viewable by everyone"
  ON public.post_rankings
  FOR SELECT
  USING (true);

-- Function to get latest rank for a post
CREATE OR REPLACE FUNCTION public.get_previous_rank(
  post_id_param UUID,
  sort_type_param TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT rank
  FROM public.post_rankings
  WHERE post_id = post_id_param
    AND sort_type = sort_type_param
  ORDER BY snapshot_at DESC
  LIMIT 1;
$$;