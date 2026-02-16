-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  total_points INTEGER DEFAULT 0 NOT NULL,
  current_level INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create levels table
CREATE TABLE public.levels (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  required_points INTEGER NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on levels (public readable)
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Levels are viewable by everyone"
  ON public.levels FOR SELECT
  USING (true);

-- Insert default levels
INSERT INTO public.levels (id, name, required_points, icon, color) VALUES
  (1, 'Rookie Fan', 0, '🌟', '#94a3b8'),
  (2, 'Rising Star', 100, '⭐', '#60a5fa'),
  (3, 'Dedicated Stan', 250, '💫', '#a78bfa'),
  (4, 'Super Fan', 500, '✨', '#f472b6'),
  (5, 'Ultimate Legend', 1000, '👑', '#fbbf24');

-- Create badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  requirement_type TEXT NOT NULL, -- 'posts', 'comments', 'votes', 'special'
  requirement_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
  ON public.badges FOR SELECT
  USING (true);

-- Insert default badges
INSERT INTO public.badges (name, description, icon, color, requirement_type, requirement_count) VALUES
  ('First Post', '첫 게시글을 작성했습니다', '📝', '#3b82f6', 'posts', 1),
  ('Active Poster', '10개의 게시글을 작성했습니다', '✍️', '#8b5cf6', 'posts', 10),
  ('Comment Master', '50개의 댓글을 작성했습니다', '💬', '#ec4899', 'comments', 50),
  ('Vote Enthusiast', '100번 투표했습니다', '👍', '#10b981', 'votes', 100),
  ('Community Leader', '특별한 기여를 했습니다', '🏆', '#f59e0b', 'special', NULL);

-- Create user_badges table (many-to-many relationship)
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, badge_id)
);

-- Enable RLS on user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges are viewable by everyone"
  ON public.user_badges FOR SELECT
  USING (true);

CREATE POLICY "Users cannot insert their own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (false);

-- Create point_transactions table for point history
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'post_created', 'comment_added', 'vote_received', etc.
  reference_id UUID, -- ID of the post/comment that triggered the points
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on point_transactions
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own point transactions"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Point transactions cannot be inserted by users"
  ON public.point_transactions FOR INSERT
  WITH CHECK (false);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();