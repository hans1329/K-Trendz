-- use_invitation_code 함수를 다회용 코드도 지원하도록 업데이트
CREATE OR REPLACE FUNCTION public.use_invitation_code(code_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id uuid;
  v_max_uses integer;
  v_current_uses integer;
  v_used_by uuid;
  v_creator_id uuid;
  v_user_id uuid;
  v_already_used boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- 코드 정보 조회
  SELECT id, max_uses, current_uses, used_by, creator_id
  INTO v_code_id, v_max_uses, v_current_uses, v_used_by, v_creator_id
  FROM invitation_codes
  WHERE code = code_param;
  
  IF v_code_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- 단일 사용 코드 (max_uses = 1)
  IF v_max_uses = 1 THEN
    -- 이미 사용된 코드인지 확인
    IF v_used_by IS NOT NULL THEN
      RETURN false;
    END IF;
    
    -- 코드 사용 처리
    UPDATE invitation_codes
    SET used_by = v_user_id,
        used_at = now(),
        current_uses = 1
    WHERE id = v_code_id;
    
  -- 다회용 코드 (max_uses > 1)
  ELSE
    -- 이미 최대 사용 횟수에 도달했는지 확인
    IF v_current_uses >= v_max_uses THEN
      RETURN false;
    END IF;
    
    -- 이 사용자가 이미 이 코드를 사용했는지 확인
    SELECT EXISTS (
      SELECT 1 FROM invitation_code_uses
      WHERE invitation_code_id = v_code_id AND user_id = v_user_id
    ) INTO v_already_used;
    
    IF v_already_used THEN
      RETURN false;
    END IF;
    
    -- 사용 기록 추가
    INSERT INTO invitation_code_uses (invitation_code_id, user_id)
    VALUES (v_code_id, v_user_id);
    
    -- 사용 횟수 증가
    UPDATE invitation_codes
    SET current_uses = current_uses + 1
    WHERE id = v_code_id;
  END IF;
  
  -- 사용자 초대 인증 완료 처리
  UPDATE profiles
  SET invitation_verified = true
  WHERE id = v_user_id;
  
  -- 초대자에게 보상 지급 (50 스타)
  IF v_creator_id IS NOT NULL AND v_creator_id != v_user_id THEN
    UPDATE profiles
    SET available_points = available_points + 50,
        total_points = total_points + 50
    WHERE id = v_creator_id;
    
    INSERT INTO point_transactions (user_id, action_type, points, reference_id)
    VALUES (v_creator_id, 'referral_bonus', 50, v_user_id);
    
    INSERT INTO notifications (user_id, type, title, message, actor_id)
    VALUES (v_creator_id, 'referral', 'Referral Bonus', 'A friend joined using your invitation code! +50 Stars', v_user_id);
  END IF;
  
  RETURN true;
END;
$$;