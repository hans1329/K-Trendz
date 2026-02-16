-- Delete the generic boost_post rule
DELETE FROM public.point_rules WHERE action_type = 'boost_post';

-- Insert period-specific boost rules
INSERT INTO public.point_rules (action_type, category, description, points, is_active)
VALUES 
  ('boost_post_1day', 'usage', 'Boost post for 1 day', -30, true),
  ('boost_post_3days', 'usage', 'Boost post for 3 days', -70, true),
  ('boost_post_7days', 'usage', 'Boost post for 7 days', -150, true)
ON CONFLICT (action_type) DO NOTHING;