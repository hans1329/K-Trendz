-- 1. point_rules 테이블에 referral_bonus 규칙 추가 (없으면)
INSERT INTO public.point_rules (action_type, category, description, points, is_active)
SELECT 'referral_bonus', 'earn', 'Bonus for inviting a friend who signs up', 50, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.point_rules WHERE action_type = 'referral_bonus'
);

-- 2. use_invitation_code 함수를 수정하여 point_rules에서 보상 금액을 읽도록 변경
CREATE OR REPLACE FUNCTION public.use_invitation_code(code_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
  v_creator_id UUID;
  v_user_id UUID := auth.uid();
  v_uses_left INTEGER;
  v_is_multi_use BOOLEAN;
  v_referral_bonus INTEGER;
BEGIN
  -- 현재 사용자 확인
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- 이미 초대 인증된 사용자인지 확인
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND invitation_verified = true) THEN
    RETURN true;
  END IF;
  
  -- 코드 찾기
  SELECT id, creator_id, uses_left, is_multi_use
  INTO v_code_id, v_creator_id, v_uses_left, v_is_multi_use
  FROM invitation_codes
  WHERE UPPER(code) = UPPER(code_param)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF v_code_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;
  
  -- 단일 사용 코드이면서 이미 사용된 경우
  IF NOT v_is_multi_use AND v_uses_left <= 0 THEN
    RAISE EXCEPTION 'This invitation code has already been used';
  END IF;
  
  -- 다회용 코드인 경우, 같은 사용자가 이미 사용했는지 확인
  IF v_is_multi_use THEN
    IF EXISTS (SELECT 1 FROM invitation_code_uses WHERE code_id = v_code_id AND used_by = v_user_id) THEN
      RAISE EXCEPTION 'You have already used this invitation code';
    END IF;
  END IF;
  
  -- 코드 사용 기록
  INSERT INTO invitation_code_uses (code_id, used_by)
  VALUES (v_code_id, v_user_id);
  
  -- 사용 횟수 감소
  UPDATE invitation_codes
  SET uses_left = uses_left - 1,
      used_at = NOW(),
      used_by = v_user_id
  WHERE id = v_code_id;
  
  -- 사용자 초대 인증 완료 처리
  UPDATE profiles
  SET invitation_verified = true
  WHERE id = v_user_id;
  
  -- point_rules에서 referral_bonus 포인트 조회 (기본값 50)
  SELECT COALESCE(points, 50) INTO v_referral_bonus
  FROM point_rules
  WHERE action_type = 'referral_bonus' AND is_active = true
  LIMIT 1;
  
  -- 기본값 설정 (규칙이 없는 경우)
  IF v_referral_bonus IS NULL THEN
    v_referral_bonus := 50;
  END IF;
  
  -- 초대자에게 보상 지급 (point_rules에서 읽은 값 사용)
  IF v_creator_id IS NOT NULL AND v_creator_id != v_user_id THEN
    UPDATE profiles
    SET available_points = available_points + v_referral_bonus,
        total_points = total_points + v_referral_bonus
    WHERE id = v_creator_id;
    
    INSERT INTO point_transactions (user_id, action_type, points, reference_id)
    VALUES (v_creator_id, 'referral_bonus', v_referral_bonus, v_user_id);
    
    INSERT INTO notifications (user_id, type, title, message, actor_id)
    VALUES (v_creator_id, 'referral', 'Referral Bonus', 'A friend joined using your invitation code! +' || v_referral_bonus || ' Stars', v_user_id);
  END IF;
  
  RETURN true;
END;
$$;