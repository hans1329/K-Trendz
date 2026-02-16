-- 기존 함수 교체: 구글 OAuth의 full_name과 avatar_url 지원
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_username TEXT;
  default_display_name TEXT;
  default_avatar_url TEXT;
  signup_bonus_points INTEGER;
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
  
  -- Insert profile with proper Google metadata
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    default_username,
    default_display_name,
    default_avatar_url
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