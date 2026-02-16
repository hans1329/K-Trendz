-- Fix award_daily_login_bonus function - cast NULL to UUID
CREATE OR REPLACE FUNCTION public.award_daily_login_bonus(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_claimed boolean;
  bonus_points integer;
BEGIN
  -- Check if user already claimed daily login today
  SELECT EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE user_id = user_id_param
      AND action_type = 'daily_login'
      AND DATE(created_at) = CURRENT_DATE
  ) INTO already_claimed;
  
  -- If not claimed yet, award points
  IF NOT already_claimed THEN
    -- Get bonus amount
    SELECT points INTO bonus_points FROM public.point_rules WHERE action_type = 'daily_login' AND is_active = true LIMIT 1;
    IF bonus_points IS NULL THEN
      bonus_points := 5;
    END IF;
    
    -- Cast NULL explicitly to UUID to avoid type mismatch
    PERFORM public.award_points(user_id_param, 'daily_login', NULL::uuid);
    
    -- Create notification for daily login bonus
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      user_id_param,
      'daily_login',
      'Daily Login Bonus',
      'You received ' || bonus_points || ' Stars for logging in today!'
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;