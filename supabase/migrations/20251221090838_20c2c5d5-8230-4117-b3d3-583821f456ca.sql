-- Add visibility column to posts table
-- 'public': 전체 공개
-- 'fans_only': 해당 wiki_entry를 follow하는 팬들만 볼 수 있음
ALTER TABLE public.posts 
ADD COLUMN visibility text NOT NULL DEFAULT 'public';

-- Add check constraint for valid values
ALTER TABLE public.posts 
ADD CONSTRAINT posts_visibility_check 
CHECK (visibility IN ('public', 'fans_only'));

-- Create index for filtering by visibility
CREATE INDEX idx_posts_visibility ON public.posts(visibility);

-- Update RLS policy to respect visibility
-- First, let's check existing policies and create a new one
-- fans_only posts should only be visible to:
-- 1. The post author
-- 2. Users who follow the wiki_entry
-- 3. Admins

-- Drop existing SELECT policy if it exists
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

-- Create new SELECT policy that respects visibility
CREATE POLICY "Posts are viewable based on visibility"
ON public.posts
FOR SELECT
USING (
  -- Public posts are visible to everyone
  visibility = 'public'
  OR
  -- Author can always see their own posts
  auth.uid() = user_id
  OR
  -- Admins can see all posts
  has_role(auth.uid(), 'admin')
  OR
  -- fans_only posts are visible to followers of the wiki_entry
  (
    visibility = 'fans_only' 
    AND wiki_entry_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM wiki_entry_followers
      WHERE wiki_entry_followers.wiki_entry_id = posts.wiki_entry_id
      AND wiki_entry_followers.user_id = auth.uid()
    )
  )
);