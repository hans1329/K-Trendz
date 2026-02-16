-- Update handle_new_user function to award signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  default_username TEXT;
  signup_bonus_points INTEGER;
BEGIN
  -- Generate username
  default_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    'user_' || substr(NEW.id::text, 1, 8)
  );
  
  -- Insert profile with username as display_name fallback (not email)
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    default_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', default_username)
  );
  
  -- Award signup bonus points
  SELECT points INTO signup_bonus_points
  FROM point_rules
  WHERE action_type = 'signup_bonus' AND is_active = true
  LIMIT 1;
  
  IF signup_bonus_points IS NOT NULL AND signup_bonus_points > 0 THEN
    -- Update user's points
    UPDATE public.profiles
    SET 
      available_points = available_points + signup_bonus_points,
      total_points = total_points + signup_bonus_points
    WHERE id = NEW.id;
    
    -- Record transaction
    INSERT INTO public.point_transactions (user_id, action_type, points)
    VALUES (NEW.id, 'signup_bonus', signup_bonus_points);
  END IF;
  
  RETURN NEW;
END;
$$;