-- Add point_price column to gift_badges table
ALTER TABLE gift_badges
ADD COLUMN point_price integer;

COMMENT ON COLUMN gift_badges.point_price IS 'Price in points (stars) for purchasing this gift badge';

-- Update existing gift badges with default point prices (can be adjusted by admin)
UPDATE gift_badges SET point_price = 50 WHERE point_price IS NULL;