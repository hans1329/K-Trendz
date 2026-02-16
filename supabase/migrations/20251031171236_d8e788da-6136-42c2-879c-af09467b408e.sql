-- Create communities table
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  creator_id UUID NOT NULL,
  banner_url TEXT,
  icon_url TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_members table for tracking memberships
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Add community_id to posts table
ALTER TABLE public.posts 
ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_posts_community_id ON public.posts(community_id);
CREATE INDEX idx_community_members_user_id ON public.community_members(user_id);
CREATE INDEX idx_community_members_community_id ON public.community_members(community_id);
CREATE INDEX idx_communities_slug ON public.communities(slug);

-- Enable RLS on new tables
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for communities
CREATE POLICY "Communities are viewable by everyone"
ON public.communities
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create communities"
ON public.communities
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Community creators can update their communities"
ON public.communities
FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Community creators can delete their communities"
ON public.communities
FOR DELETE
USING (auth.uid() = creator_id);

-- RLS Policies for community_members
CREATE POLICY "Community memberships are viewable by everyone"
ON public.community_members
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can join communities"
ON public.community_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
ON public.community_members
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at on communities
CREATE TRIGGER update_communities_updated_at
BEFORE UPDATE ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update member count
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
    SET member_count = member_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
    SET member_count = member_count - 1
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to automatically update member count
CREATE TRIGGER update_member_count_on_join
AFTER INSERT ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.update_community_member_count();

CREATE TRIGGER update_member_count_on_leave
AFTER DELETE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.update_community_member_count();

-- Function to update post count
CREATE OR REPLACE FUNCTION public.update_community_post_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.community_id IS NOT NULL THEN
    UPDATE public.communities
    SET post_count = post_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' AND OLD.community_id IS NOT NULL THEN
    UPDATE public.communities
    SET post_count = post_count - 1
    WHERE id = OLD.community_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.community_id IS NOT NULL AND NEW.community_id IS NULL THEN
      UPDATE public.communities
      SET post_count = post_count - 1
      WHERE id = OLD.community_id;
    ELSIF OLD.community_id IS NULL AND NEW.community_id IS NOT NULL THEN
      UPDATE public.communities
      SET post_count = post_count + 1
      WHERE id = NEW.community_id;
    ELSIF OLD.community_id IS NOT NULL AND NEW.community_id IS NOT NULL AND OLD.community_id != NEW.community_id THEN
      UPDATE public.communities
      SET post_count = post_count - 1
      WHERE id = OLD.community_id;
      UPDATE public.communities
      SET post_count = post_count + 1
      WHERE id = NEW.community_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to automatically update post count
CREATE TRIGGER update_post_count_on_insert
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_community_post_count();

CREATE TRIGGER update_post_count_on_delete
AFTER DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_community_post_count();

CREATE TRIGGER update_post_count_on_update
AFTER UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_community_post_count();