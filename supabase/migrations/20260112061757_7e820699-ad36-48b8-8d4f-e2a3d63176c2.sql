
-- handle_new_user 함수를 수정하여 INSERT 시점에 바로 포인트를 설정하도록 변경
-- 별도 UPDATE 없이 INSERT 한 번에 처리

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_username TEXT;
  default_display_name TEXT;
  default_avatar_url TEXT;
  signup_bonus_points INTEGER := 0;
BEGIN
  -- Generate username from various sources
  default_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'preferred_username',
    'user_' || substr(NEW.id::text, 1, 8)
  );
  
  -- Get display name from Google's full_name or name fields
  default_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    default_username
  );
  
  -- Get avatar URL from Google
  default_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  
  -- Get signup bonus points
  SELECT points INTO signup_bonus_points
  FROM point_rules
  WHERE action_type = 'signup_bonus' AND is_active = true
  LIMIT 1;
  
  -- Default to 0 if no bonus configured
  signup_bonus_points := COALESCE(signup_bonus_points, 0);
  
  -- Insert profile with points in a single INSERT (no UPDATE needed)
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    avatar_url,
    available_points,
    total_points
  )
  VALUES (
    NEW.id,
    default_username,
    default_display_name,
    default_avatar_url,
    signup_bonus_points,
    signup_bonus_points
  );
  
  -- Record transaction if bonus was awarded
  IF signup_bonus_points > 0 THEN
    INSERT INTO public.point_transactions (user_id, action_type, points)
    VALUES (NEW.id, 'signup_bonus', signup_bonus_points);
  END IF;
  
  RETURN NEW;
END;
$$;
