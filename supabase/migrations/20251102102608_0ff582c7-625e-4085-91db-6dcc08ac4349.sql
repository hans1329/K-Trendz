-- Add approval and auto-generation flags to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_approval ON public.posts(is_auto_generated, is_approved);

-- Add comment for documentation
COMMENT ON COLUMN public.posts.is_auto_generated IS 'True if post was auto-generated from news feeds';
COMMENT ON COLUMN public.posts.is_approved IS 'True if post has been approved by moderator/admin for public display';
COMMENT ON COLUMN public.posts.approved_by IS 'User ID of moderator/admin who approved the post';
COMMENT ON COLUMN public.posts.approved_at IS 'Timestamp when post was approved';