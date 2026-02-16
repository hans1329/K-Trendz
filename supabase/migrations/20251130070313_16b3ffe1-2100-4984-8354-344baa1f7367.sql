-- Add issue_lightstick point rule to spend_stars category
INSERT INTO point_rules (action_type, category, description, points, is_active)
VALUES ('issue_lightstick', 'spend_stars', 'Issue a Lightstick token for wiki entry or post', -100, true)
ON CONFLICT DO NOTHING;