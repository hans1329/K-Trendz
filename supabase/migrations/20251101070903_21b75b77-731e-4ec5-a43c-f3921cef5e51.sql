-- Function to deduct points from a user
CREATE OR REPLACE FUNCTION public.deduct_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  points_to_deduct integer;
  current_available_points integer;
BEGIN
  -- Get point value from rules (will be negative)
  points_to_deduct := public.get_point_value(action_type_param);
  
  -- Get user's current available points
  SELECT available_points INTO current_available_points
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Check if user has enough points (points_to_deduct is negative, so we add)
  IF current_available_points + points_to_deduct < 0 THEN
    RETURN false; -- Not enough points
  END IF;
  
  -- Deduct points (available_points only, total_points stays for XP/level)
  UPDATE public.profiles
  SET available_points = available_points + points_to_deduct
  WHERE id = user_id_param;
  
  -- Record transaction
  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (user_id_param, action_type_param, points_to_deduct, reference_id_param);
  
  RETURN true;
END;
$$;

-- Trigger function to deduct points when creating a community
CREATE OR REPLACE FUNCTION public.deduct_points_on_community_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  points_deducted boolean;
BEGIN
  -- Try to deduct points for creating custom community
  points_deducted := public.deduct_points(NEW.creator_id, 'create_custom_community', NEW.id);
  
  -- If points couldn't be deducted, prevent community creation
  IF NOT points_deducted THEN
    RAISE EXCEPTION 'Insufficient points to create community';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for community creation
CREATE TRIGGER deduct_points_on_community_create_trigger
BEFORE INSERT ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.deduct_points_on_community_create();