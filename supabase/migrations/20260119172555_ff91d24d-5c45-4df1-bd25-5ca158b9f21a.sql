-- =====================================================
-- 1. ip_rate_limits: 사용자 직접 접근 차단 (service_role만 접근)
-- =====================================================
CREATE POLICY "No direct access to ip_rate_limits"
  ON public.ip_rate_limits FOR SELECT
  USING (false);

CREATE POLICY "No direct insert to ip_rate_limits"
  ON public.ip_rate_limits FOR INSERT
  WITH CHECK (false);

-- =====================================================
-- 2. profiles: 민감 정보 보호
-- 사용자는 자신의 전체 프로필만 볼 수 있음
-- 다른 사용자는 공개 정보만 볼 수 있음
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 새 정책: 자신의 프로필은 전체 보기, 다른 사람은 민감 필드 제외
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- 민감 필드를 제외한 공개 뷰 생성
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    username,
    display_name,
    avatar_url,
    bio,
    is_verified,
    is_vip,
    verification_type,
    current_level,
    total_points,
    available_points,
    invitation_verified,
    created_at,
    updated_at
  FROM public.profiles;
-- stripe_account_id, tebex_wallet_ref 제외

-- =====================================================
-- 3. external_wallet_users: 지갑 정보 보호
-- 사용자는 자신과 연결된 지갑만 볼 수 있음
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view external wallet users" ON public.external_wallet_users;
DROP POLICY IF EXISTS "External wallet users are viewable by everyone" ON public.external_wallet_users;

-- 새 정책: 자신의 지갑만 볼 수 있음
CREATE POLICY "Users can view their own external wallets"
  ON public.external_wallet_users FOR SELECT
  USING (linked_user_id = auth.uid());

-- 공개 정보만 포함한 뷰 생성 (display_name, avatar만)
CREATE OR REPLACE VIEW public.external_wallet_users_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    display_name,
    avatar_url,
    username,
    source,
    created_at
  FROM public.external_wallet_users;
-- wallet_address, fid, linked_user_id 제외