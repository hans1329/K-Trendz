-- Add point rules for voting actions
INSERT INTO public.point_rules (action_type, description, points, category, is_active)
VALUES 
  ('vote_post', 'Cost to vote on a post', -1, 'Voting', true),
  ('vote_wiki', 'Cost to vote on a wiki entry', -1, 'Voting', true),
  ('vote_comment', 'Cost to vote on a comment', -1, 'Voting', true)
ON CONFLICT (action_type) DO NOTHING;