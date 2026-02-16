-- =====================================================
-- 1. Edge Function/DB Trigger로만 처리되는 테이블들
--    "WITH CHECK (true)" 정책 삭제
-- =====================================================

-- ai_data_contributions: Edge Function + DB Trigger만 사용
DROP POLICY IF EXISTS "System can insert contributions" ON public.ai_data_contributions;

-- entry_fund_transactions: Edge Function + DB Function만 사용
DROP POLICY IF EXISTS "Service role can insert fund transactions" ON public.entry_fund_transactions;

-- external_challenge_participations: Edge Function만 사용
DROP POLICY IF EXISTS "System can insert participations" ON public.external_challenge_participations;
DROP POLICY IF EXISTS "System can update participations" ON public.external_challenge_participations;

-- external_wallet_users: Edge Function만 사용
DROP POLICY IF EXISTS "System can insert external wallet users" ON public.external_wallet_users;
DROP POLICY IF EXISTS "System can update external wallet users" ON public.external_wallet_users;

-- fanz_balances: Edge Function만 사용
DROP POLICY IF EXISTS "System can manage balances" ON public.fanz_balances;

-- invitation_code_uses: DB Function만 사용
DROP POLICY IF EXISTS "System can insert uses" ON public.invitation_code_uses;

-- invitation_codes: DB Function만 사용
DROP POLICY IF EXISTS "System can update codes" ON public.invitation_codes;

-- pioneer_claims: Edge Function만 사용
DROP POLICY IF EXISTS "System can insert pioneer claims" ON public.pioneer_claims;
DROP POLICY IF EXISTS "System can update pioneer claims" ON public.pioneer_claims;

-- point_purchases: Edge Function (Stripe webhook)만 사용
DROP POLICY IF EXISTS "System can insert purchases" ON public.point_purchases;

-- wiki_edit_history: DB Trigger만 사용
DROP POLICY IF EXISTS "System can insert edit history" ON public.wiki_edit_history;

-- wiki_entry_user_contributions: DB Trigger만 사용
DROP POLICY IF EXISTS "System can manage contributions" ON public.wiki_entry_user_contributions;

-- withdrawal_gas_transfers: Edge Function만 사용
DROP POLICY IF EXISTS "System can insert gas transfers" ON public.withdrawal_gas_transfers;

-- =====================================================
-- 2. user_gift_badge_inventory: 본인 데이터만 조작 가능하도록 수정
-- =====================================================

-- 기존 과도하게 허용된 정책 삭제
DROP POLICY IF EXISTS "Users can manage their inventory" ON public.user_gift_badge_inventory;
DROP POLICY IF EXISTS "System can manage inventory" ON public.user_gift_badge_inventory;
DROP POLICY IF EXISTS "Authenticated users can insert into inventory" ON public.user_gift_badge_inventory;
DROP POLICY IF EXISTS "Authenticated users can update own inventory" ON public.user_gift_badge_inventory;

-- 본인 데이터만 조회 가능
CREATE POLICY "Users can view own inventory"
ON public.user_gift_badge_inventory
FOR SELECT
USING (auth.uid() = user_id);

-- 본인 데이터만 삽입 가능 (user_id가 본인과 일치해야 함)
CREATE POLICY "Users can insert own inventory"
ON public.user_gift_badge_inventory
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 본인 데이터만 업데이트 가능
CREATE POLICY "Users can update own inventory"
ON public.user_gift_badge_inventory
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. notifications: Admin만 삽입 가능, 본인만 조회/업데이트 가능
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- Admin 역할 확인 함수 (이미 존재하면 무시)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND role = 'admin'
  )
$$;

-- Admin만 알림 삽입 가능
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- 4. master_applications: INSERT는 누구나, UPDATE/DELETE는 Admin만
-- =====================================================

-- 기존 과도하게 허용된 정책 삭제
DROP POLICY IF EXISTS "Anyone can insert master applications" ON public.master_applications;
DROP POLICY IF EXISTS "System can update master applications" ON public.master_applications;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.master_applications;

-- 인증된 사용자는 지원서 제출 가능
CREATE POLICY "Authenticated users can submit applications"
ON public.master_applications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Admin만 업데이트 가능
CREATE POLICY "Admins can update applications"
ON public.master_applications
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Admin만 삭제 가능
CREATE POLICY "Admins can delete applications"
ON public.master_applications
FOR DELETE
USING (public.is_admin(auth.uid()));