-- Update all levels to have 13 max daily votes
UPDATE levels 
SET max_daily_votes = 13;

-- Verify the change
COMMENT ON TABLE levels IS 'All levels now have fixed 13 daily votes, but token_reward varies by level';