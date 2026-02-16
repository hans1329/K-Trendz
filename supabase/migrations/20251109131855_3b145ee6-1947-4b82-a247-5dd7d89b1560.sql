-- Add signup bonus point rule
INSERT INTO point_rules (action_type, category, description, points, is_active)
VALUES ('signup_bonus', 'earn', 'Welcome bonus for new user signup', 100, true)
ON CONFLICT (action_type) DO UPDATE SET
  description = EXCLUDED.description,
  points = EXCLUDED.points,
  is_active = EXCLUDED.is_active;