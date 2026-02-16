-- 초대 코드 생성 함수 수정 (6자리)
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  remaining INT;
  current_user_id UUID;
  is_user_vip BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  -- VIP 여부 확인
  SELECT is_vip INTO is_user_vip FROM profiles WHERE id = current_user_id;
  
  -- VIP가 아닌 경우 남은 코드 수 확인
  IF NOT COALESCE(is_user_vip, false) THEN
    SELECT get_remaining_invitation_codes(current_user_id) INTO remaining;
    IF remaining <= 0 THEN
      RETURN NULL;
    END IF;
  END IF;
  
  -- 6자리 고유 코드 생성
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invitation_codes WHERE code = new_code);
  END LOOP;
  
  -- 코드 저장
  INSERT INTO invitation_codes (code, creator_id)
  VALUES (new_code, current_user_id);
  
  RETURN new_code;
END;
$$;