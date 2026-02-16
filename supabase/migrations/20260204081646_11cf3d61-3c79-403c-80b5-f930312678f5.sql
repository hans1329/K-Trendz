-- 응원봉 구매 시 지급할 보너스 스타 규칙 추가
INSERT INTO point_rules (action_type, points, description, category, is_active) 
VALUES ('fanztoken_purchase_bonus', 100, 'Bonus Stars for purchasing a LightStick', 'earn', true)
ON CONFLICT (action_type) DO UPDATE SET
  points = EXCLUDED.points,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;