-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS deduct_points_on_wiki_create ON public.wiki_entries;
DROP FUNCTION IF EXISTS deduct_points_for_wiki_entry();

-- Create updated function that skips point check for verified auto-generated entries
CREATE OR REPLACE FUNCTION deduct_points_for_wiki_entry()
RETURNS TRIGGER AS $$
DECLARE
  wiki_create_points INTEGER;
  user_available_points INTEGER;
BEGIN
  -- Skip point deduction for auto-generated verified entries
  IF NEW.is_verified = true THEN
    RETURN NEW;
  END IF;

  -- Get the point cost for wiki creation
  SELECT points INTO wiki_create_points
  FROM point_rules
  WHERE action_type = 'wiki_create' AND is_active = true
  LIMIT 1;

  -- If no rule found, allow creation
  IF wiki_create_points IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's available points
  SELECT available_points INTO user_available_points
  FROM profiles
  WHERE id = NEW.creator_id;

  -- Check if user has enough points (only for negative point costs)
  IF wiki_create_points < 0 AND user_available_points < ABS(wiki_create_points) THEN
    RAISE EXCEPTION 'Insufficient points to create wiki entry';
  END IF;

  -- Deduct or award points
  UPDATE profiles
  SET available_points = available_points + wiki_create_points
  WHERE id = NEW.creator_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER deduct_points_on_wiki_create
  BEFORE INSERT ON public.wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION deduct_points_for_wiki_entry();