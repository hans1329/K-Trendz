INSERT INTO public.point_rules (action_type, points, category, description, is_active)
VALUES ('agent_generate', -3, 'spend', 'Manual agent message generation cost', true)
ON CONFLICT (action_type) DO NOTHING;