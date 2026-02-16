-- Update levels table with new level system and daily energy allocation
-- New level names, energy amounts, and required points

UPDATE levels SET 
  name = 'Rookie Fan',
  max_daily_votes = 5,
  required_points = 0,
  icon = '🌱',
  color = '#10b981'
WHERE id = 1;

UPDATE levels SET 
  name = 'Rising Star',
  max_daily_votes = 13,
  required_points = 1000,
  icon = '⭐',
  color = '#3b82f6'
WHERE id = 2;

UPDATE levels SET 
  name = 'Dedicated Stan',
  max_daily_votes = 18,
  required_points = 5000,
  icon = '💎',
  color = '#8b5cf6'
WHERE id = 3;

UPDATE levels SET 
  name = 'Super Fan',
  max_daily_votes = 22,
  required_points = 15000,
  icon = '👑',
  color = '#f59e0b'
WHERE id = 4;

UPDATE levels SET 
  name = 'Ultimate Legend',
  max_daily_votes = 30,
  required_points = 50000,
  icon = '🏆',
  color = '#ef4444'
WHERE id = 5;

-- Add token_reward column to levels table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'levels' 
                AND column_name = 'token_reward') THEN
    ALTER TABLE levels ADD COLUMN token_reward integer DEFAULT 10;
  END IF;
END $$;

-- Update token rewards for each level (activity completion rewards)
UPDATE levels SET token_reward = 10 WHERE id = 1;  -- Rookie Fan: 10 tokens
UPDATE levels SET token_reward = 15 WHERE id = 2;  -- Rising Star: 15 tokens
UPDATE levels SET token_reward = 20 WHERE id = 3;  -- Dedicated Stan: 20 tokens
UPDATE levels SET token_reward = 30 WHERE id = 4;  -- Super Fan: 30 tokens
UPDATE levels SET token_reward = 40 WHERE id = 5;  -- Ultimate Legend: 40 tokens

-- Add comment to describe the system
COMMENT ON COLUMN levels.max_daily_votes IS 'Daily energy allocation for this level';
COMMENT ON COLUMN levels.token_reward IS 'KTRNDZ tokens earned for completing daily activities at this level';
COMMENT ON TABLE levels IS 'User level progression system. When DAU exceeds 100K, Season 2 will adjust token rewards.';