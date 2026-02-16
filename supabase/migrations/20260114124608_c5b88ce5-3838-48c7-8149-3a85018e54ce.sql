
-- protect_user_points 함수를 수정하여 내부 함수 호출을 허용
CREATE OR REPLACE FUNCTION public.protect_user_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role은 허용 (Edge Functions에서 호출)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- 내부 함수에서 설정한 bypass 플래그 확인
  IF current_setting('app.bypass_points_protection', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- 사용자가 자신의 프로필을 수정할 때 포인트 변경 시도 감지
  IF OLD.available_points IS DISTINCT FROM NEW.available_points THEN
    RAISE EXCEPTION 'Direct modification of available_points is not allowed';
  END IF;
  
  IF OLD.total_points IS DISTINCT FROM NEW.total_points THEN
    RAISE EXCEPTION 'Direct modification of total_points is not allowed';
  END IF;
  
  IF OLD.current_level IS DISTINCT FROM NEW.current_level THEN
    RAISE EXCEPTION 'Direct modification of current_level is not allowed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- deduct_points 함수를 수정하여 bypass 플래그 설정
CREATE OR REPLACE FUNCTION public.deduct_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_deduct integer;
  current_available_points integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);
  
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

-- award_points 함수도 bypass 플래그 설정
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param uuid,
  action_type_param text,
  reference_id_param text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_award integer;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);
  
  -- Get point value from rules
  points_to_award := public.get_point_value(action_type_param);
  
  -- Only proceed if points > 0
  IF points_to_award > 0 THEN
    -- Update user's points
    UPDATE public.profiles
    SET 
      available_points = available_points + points_to_award,
      total_points = total_points + points_to_award
    WHERE id = user_id_param;
    
    -- Record transaction
    INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
    VALUES (user_id_param, action_type_param, points_to_award, reference_id_param);
  END IF;
END;
$$;

-- deduct_points_for_wiki_entry 함수도 bypass 플래그 설정
CREATE OR REPLACE FUNCTION public.deduct_points_for_wiki_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wiki_create_points INTEGER;
  user_available_points INTEGER;
BEGIN
  -- bypass 플래그 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);
  
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
$$;
