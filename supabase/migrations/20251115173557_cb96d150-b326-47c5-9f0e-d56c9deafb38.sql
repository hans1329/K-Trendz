-- Create AI Data Contributions table
CREATE TABLE IF NOT EXISTS public.ai_data_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'wiki_entry', 'post', 'comment'
  content_id UUID NOT NULL,
  contribution_quality_score INTEGER NOT NULL DEFAULT 0,
  ai_model_version TEXT,
  used_in_training BOOLEAN NOT NULL DEFAULT false,
  training_date TIMESTAMP WITH TIME ZONE,
  reward_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for user queries
CREATE INDEX idx_ai_data_contributions_user_id ON public.ai_data_contributions(user_id);
CREATE INDEX idx_ai_data_contributions_content ON public.ai_data_contributions(content_type, content_id);

-- Enable RLS
ALTER TABLE public.ai_data_contributions ENABLE ROW LEVEL SECURITY;

-- Users can view their own AI contributions
CREATE POLICY "Users can view their own AI contributions"
  ON public.ai_data_contributions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all AI contributions
CREATE POLICY "Admins can view all AI contributions"
  ON public.ai_data_contributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can insert AI contributions
CREATE POLICY "System can insert AI contributions"
  ON public.ai_data_contributions
  FOR INSERT
  WITH CHECK (true);

-- Add new point rules for AI data contributions
INSERT INTO public.point_rules (action_type, category, description, points, is_active)
VALUES
  ('ai_data_accepted', 'contribution', 'AI training data accepted', 50, true),
  ('ai_data_high_quality', 'contribution', 'High quality AI training data', 100, true),
  ('ai_training_milestone', 'achievement', 'AI training contribution milestone', 500, true)
ON CONFLICT (action_type) DO NOTHING;