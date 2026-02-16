-- 1. write_comment 규칙을 earn에서 spend로 변경하고 points를 음수로 변경
UPDATE point_rules 
SET category = 'spend', points = -2 
WHERE action_type = 'write_comment';

-- 2. 트리거 함수를 차감 로직으로 변경
CREATE OR REPLACE FUNCTION public.award_points_on_comment_create()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points_deducted boolean;
BEGIN
  -- Deduct points for writing a comment
  points_deducted := public.deduct_points(NEW.user_id, 'write_comment', NEW.id);
  
  -- If points couldn't be deducted, prevent comment creation
  IF NOT points_deducted THEN
    RAISE EXCEPTION 'Insufficient points to write a comment';
  END IF;
  
  RETURN NEW;
END;
$function$;