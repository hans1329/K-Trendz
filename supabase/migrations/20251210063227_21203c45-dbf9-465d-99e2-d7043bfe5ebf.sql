-- 1. invitation_codes 테이블 생성
CREATE TABLE public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. profiles 테이블에 초대 확인 여부 및 VIP 상태 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN invitation_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

-- 3. RLS 활성화
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 누구나 초대 코드 확인 가능 (사용 전)
CREATE POLICY "Anyone can check unused invitation codes"
ON public.invitation_codes
FOR SELECT
USING (used_by IS NULL);

-- 5. RLS 정책: 유저는 자신의 초대 코드 조회 가능
CREATE POLICY "Users can view their own invitation codes"
ON public.invitation_codes
FOR SELECT
USING (auth.uid() = creator_id);

-- 6. RLS 정책: 유저는 초대 코드 생성 가능
CREATE POLICY "Users can create invitation codes"
ON public.invitation_codes
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- 7. RLS 정책: 시스템이 초대 코드 사용 처리 가능
CREATE POLICY "System can update invitation codes"
ON public.invitation_codes
FOR UPDATE
USING (true);

-- 8. 관리자는 모든 초대 코드 관리 가능
CREATE POLICY "Admins can manage all invitation codes"
ON public.invitation_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 9. 초대 코드 사용 처리 함수
CREATE OR REPLACE FUNCTION public.use_invitation_code(code_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- 초대 코드 확인
  SELECT * INTO invitation_record
  FROM invitation_codes
  WHERE code = code_param AND used_by IS NULL;
  
  IF invitation_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- 초대 코드 사용 처리
  UPDATE invitation_codes
  SET used_by = auth.uid(), used_at = now()
  WHERE id = invitation_record.id;
  
  -- 유저 초대 확인 상태 업데이트
  UPDATE profiles
  SET invitation_verified = true
  WHERE id = auth.uid();
  
  -- 초대한 사람에게 보너스 포인트 지급 (50 Stars)
  UPDATE profiles
  SET available_points = available_points + 50,
      total_points = total_points + 50
  WHERE id = invitation_record.creator_id;
  
  -- 포인트 트랜잭션 기록
  INSERT INTO point_transactions (user_id, action_type, points, reference_id)
  VALUES (invitation_record.creator_id, 'referral_bonus', 50, auth.uid());
  
  RETURN true;
END;
$$;

-- 10. 유저의 남은 초대 코드 수 확인 함수
CREATE OR REPLACE FUNCTION public.get_remaining_invitation_codes(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_user_vip BOOLEAN;
  used_codes INTEGER;
  max_codes INTEGER := 6;
BEGIN
  -- VIP 확인
  SELECT is_vip INTO is_user_vip
  FROM profiles
  WHERE id = user_id_param;
  
  IF is_user_vip THEN
    RETURN 999; -- VIP는 무한정
  END IF;
  
  -- 사용된 초대 코드 수 확인
  SELECT COUNT(*) INTO used_codes
  FROM invitation_codes
  WHERE creator_id = user_id_param;
  
  RETURN GREATEST(max_codes - used_codes, 0);
END;
$$;

-- 11. 초대 코드 생성 함수
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  remaining INTEGER;
BEGIN
  -- 남은 초대 코드 수 확인
  remaining := get_remaining_invitation_codes(auth.uid());
  
  IF remaining <= 0 THEN
    RAISE EXCEPTION 'No remaining invitation codes';
  END IF;
  
  -- 랜덤 코드 생성 (8자리 영숫자)
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  -- 중복 확인 후 재생성
  WHILE EXISTS (SELECT 1 FROM invitation_codes WHERE code = new_code) LOOP
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END LOOP;
  
  -- 초대 코드 저장
  INSERT INTO invitation_codes (code, creator_id)
  VALUES (new_code, auth.uid());
  
  RETURN new_code;
END;
$$;