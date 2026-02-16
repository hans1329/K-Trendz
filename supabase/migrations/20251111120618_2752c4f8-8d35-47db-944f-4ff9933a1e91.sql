-- Create daily vote tracking table
CREATE TABLE IF NOT EXISTS public.daily_vote_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_count INTEGER NOT NULL DEFAULT 0,
  vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, vote_date)
);

-- Enable RLS
ALTER TABLE public.daily_vote_counts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own vote counts"
  ON public.daily_vote_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vote counts"
  ON public.daily_vote_counts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vote counts"
  ON public.daily_vote_counts FOR UPDATE
  USING (auth.uid() = user_id);

-- Add daily vote completion rule to point_rules if not exists
INSERT INTO public.point_rules (action_type, points, description, category, is_active)
VALUES ('daily_vote_completion', 10, 'Complete 13 votes in a day', 'activity', true)
ON CONFLICT (action_type) DO NOTHING;

-- Function to check and increment daily vote count
CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(user_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count INTEGER;
  max_votes INTEGER := 13;
  can_vote BOOLEAN;
  remaining_votes INTEGER;
  completion_rewarded BOOLEAN := false;
BEGIN
  -- Get or create today's vote count
  INSERT INTO public.daily_vote_counts (user_id, vote_count, vote_date)
  VALUES (user_id_param, 0, CURRENT_DATE)
  ON CONFLICT (user_id, vote_date) 
  DO NOTHING;
  
  -- Get current count
  SELECT vote_count INTO current_count
  FROM public.daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
  
  -- Check if can vote
  can_vote := current_count < max_votes;
  
  IF can_vote THEN
    -- Increment vote count
    UPDATE public.daily_vote_counts
    SET vote_count = vote_count + 1, updated_at = now()
    WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
    
    current_count := current_count + 1;
    
    -- Check if completed all 13 votes for the first time today
    IF current_count = max_votes THEN
      -- Check if already rewarded today
      IF NOT EXISTS (
        SELECT 1 FROM public.point_transactions
        WHERE user_id = user_id_param
          AND action_type = 'daily_vote_completion'
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        -- Award completion bonus
        PERFORM public.award_points(user_id_param, 'daily_vote_completion', NULL);
        completion_rewarded := true;
      END IF;
    END IF;
  END IF;
  
  remaining_votes := GREATEST(max_votes - current_count, 0);
  
  RETURN jsonb_build_object(
    'can_vote', can_vote,
    'current_count', current_count,
    'max_votes', max_votes,
    'remaining_votes', remaining_votes,
    'completion_rewarded', completion_rewarded
  );
END;
$$;

-- Function to get current daily vote status
CREATE OR REPLACE FUNCTION public.get_daily_vote_status(user_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count INTEGER;
  max_votes INTEGER := 13;
  remaining_votes INTEGER;
BEGIN
  -- Get today's vote count
  SELECT COALESCE(vote_count, 0) INTO current_count
  FROM public.daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;
  
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;
  
  remaining_votes := GREATEST(max_votes - current_count, 0);
  
  RETURN jsonb_build_object(
    'current_count', current_count,
    'max_votes', max_votes,
    'remaining_votes', remaining_votes,
    'can_vote', current_count < max_votes
  );
END;
$$;