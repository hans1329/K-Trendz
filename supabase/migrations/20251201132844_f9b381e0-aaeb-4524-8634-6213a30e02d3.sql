-- Create daily_post_counts table
CREATE TABLE IF NOT EXISTS public.daily_post_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_count INTEGER NOT NULL DEFAULT 0,
  post_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, post_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_post_counts_user_date ON public.daily_post_counts(user_id, post_date);

-- Enable RLS
ALTER TABLE public.daily_post_counts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own post counts"
  ON public.daily_post_counts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post counts"
  ON public.daily_post_counts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post counts"
  ON public.daily_post_counts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to get daily post status
CREATE OR REPLACE FUNCTION public.get_daily_post_status(user_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count INTEGER;
  max_posts INTEGER := 10;
  remaining_posts INTEGER;
BEGIN
  -- Get today's post count
  SELECT COALESCE(post_count, 0) INTO current_count
  FROM public.daily_post_counts
  WHERE user_id = user_id_param AND post_date = CURRENT_DATE;
  
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;
  
  remaining_posts := GREATEST(max_posts - current_count, 0);
  
  RETURN jsonb_build_object(
    'current_count', current_count,
    'max_posts', max_posts,
    'remaining_posts', remaining_posts,
    'can_post', current_count < max_posts
  );
END;
$$;

-- Function to increment post count
CREATE OR REPLACE FUNCTION public.increment_daily_post_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Get current count
  SELECT post_count INTO current_count
  FROM public.daily_post_counts
  WHERE user_id = NEW.user_id AND post_date = CURRENT_DATE;
  
  -- Check if user has reached limit
  IF current_count >= 10 THEN
    RAISE EXCEPTION 'Daily post limit reached. You can only create 10 posts per day.';
  END IF;
  
  -- Insert or update count
  INSERT INTO public.daily_post_counts (user_id, post_count, post_date)
  VALUES (NEW.user_id, 1, CURRENT_DATE)
  ON CONFLICT (user_id, post_date)
  DO UPDATE SET 
    post_count = daily_post_counts.post_count + 1,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to increment post count
DROP TRIGGER IF EXISTS increment_post_count_trigger ON public.posts;
CREATE TRIGGER increment_post_count_trigger
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_daily_post_count();