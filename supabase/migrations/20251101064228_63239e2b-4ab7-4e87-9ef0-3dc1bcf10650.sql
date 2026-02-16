-- Add available_points column to profiles table
ALTER TABLE public.profiles
ADD COLUMN available_points integer NOT NULL DEFAULT 0;

-- Create point_rules table for configurable point rules
CREATE TABLE public.point_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL UNIQUE,
  points integer NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'earn' or 'spend'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on point_rules
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

-- Everyone can view point rules
CREATE POLICY "Point rules are viewable by everyone"
ON public.point_rules
FOR SELECT
USING (true);

-- Only admins can insert point rules (will be handled by admin interface)
CREATE POLICY "Admins can insert point rules"
ON public.point_rules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update point rules
CREATE POLICY "Admins can update point rules"
ON public.point_rules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete point rules
CREATE POLICY "Admins can delete point rules"
ON public.point_rules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_point_rules_updated_at
BEFORE UPDATE ON public.point_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default point rules for earning
INSERT INTO public.point_rules (action_type, points, description, category) VALUES
('create_post', 10, 'Create a new post', 'earn'),
('receive_upvote', 1, 'Receive an upvote on your post', 'earn'),
('write_comment', 2, 'Write a comment', 'earn'),
('daily_login', 5, 'Daily login bonus', 'earn'),
('first_post_in_community', 15, 'First post in a community', 'earn'),
('post_trending', 20, 'Post reaches trending', 'earn');

-- Insert default point rules for spending
INSERT INTO public.point_rules (action_type, points, description, category) VALUES
('create_custom_community', -100, 'Create a custom community', 'spend'),
('pin_post', -50, 'Pin a post in community', 'spend'),
('boost_post', -200, 'Boost/highlight a post', 'spend'),
('custom_badge', -150, 'Purchase custom profile badge', 'spend'),
('profile_theme', -100, 'Purchase profile theme', 'spend');