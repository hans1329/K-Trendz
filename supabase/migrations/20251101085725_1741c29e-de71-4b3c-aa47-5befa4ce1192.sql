-- Create mentions table for tracking user mentions in posts and comments
CREATE TABLE public.mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  mentioner_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT mention_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR 
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_mentions_mentioned_user ON public.mentions(mentioned_user_id);
CREATE INDEX idx_mentions_post ON public.mentions(post_id);
CREATE INDEX idx_mentions_comment ON public.mentions(comment_id);

-- Enable RLS
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- Mentions are viewable by everyone
CREATE POLICY "Mentions are viewable by everyone" 
ON public.mentions 
FOR SELECT 
USING (true);

-- Users can create mentions
CREATE POLICY "Users can create mentions" 
ON public.mentions 
FOR INSERT 
WITH CHECK (auth.uid() = mentioner_user_id);

-- Users can delete their own mentions
CREATE POLICY "Users can delete their own mentions" 
ON public.mentions 
FOR DELETE 
USING (auth.uid() = mentioner_user_id);