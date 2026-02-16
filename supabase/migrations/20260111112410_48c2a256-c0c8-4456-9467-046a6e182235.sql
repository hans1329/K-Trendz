-- =====================================================
-- 🔒 USDC/KTNZ 보안 강화 Migration
-- =====================================================

-- 1. usdc_balances: 사용자 직접 INSERT/UPDATE/DELETE 차단
-- (Edge Function에서 service_role로만 조작 가능)

-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Users cannot insert USDC balance" ON public.usdc_balances;
DROP POLICY IF EXISTS "Users cannot update USDC balance" ON public.usdc_balances;
DROP POLICY IF EXISTS "Users cannot delete USDC balance" ON public.usdc_balances;

-- INSERT 차단 (service_role만 가능, anon/authenticated 불가)
CREATE POLICY "Users cannot insert USDC balance" 
ON public.usdc_balances 
FOR INSERT 
WITH CHECK (false);

-- UPDATE 차단
CREATE POLICY "Users cannot update USDC balance" 
ON public.usdc_balances 
FOR UPDATE 
USING (false);

-- DELETE 차단
CREATE POLICY "Users cannot delete USDC balance" 
ON public.usdc_balances 
FOR DELETE 
USING (false);

-- =====================================================
-- 2. usdc_transactions: 사용자 직접 INSERT/UPDATE/DELETE 차단
-- =====================================================

DROP POLICY IF EXISTS "Users cannot insert USDC transactions" ON public.usdc_transactions;
DROP POLICY IF EXISTS "Users cannot update USDC transactions" ON public.usdc_transactions;
DROP POLICY IF EXISTS "Users cannot delete USDC transactions" ON public.usdc_transactions;

-- INSERT 차단
CREATE POLICY "Users cannot insert USDC transactions" 
ON public.usdc_transactions 
FOR INSERT 
WITH CHECK (false);

-- UPDATE 차단
CREATE POLICY "Users cannot update USDC transactions" 
ON public.usdc_transactions 
FOR UPDATE 
USING (false);

-- DELETE 차단
CREATE POLICY "Users cannot delete USDC transactions" 
ON public.usdc_transactions 
FOR DELETE 
USING (false);

-- =====================================================
-- 3. profiles: available_points, total_points 보호
-- 트리거로 사용자가 직접 포인트 수정하는 것 차단
-- =====================================================

-- 포인트 보호 함수 생성
CREATE OR REPLACE FUNCTION public.protect_user_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role은 허용 (Edge Functions에서 호출)
  IF current_setting('role', true) = 'service_role' THEN
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

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS protect_points_trigger ON public.profiles;

-- 트리거 생성
CREATE TRIGGER protect_points_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_points();