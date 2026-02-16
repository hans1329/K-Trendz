-- wallet_private_keys 테이블에서 Admin SELECT 정책 제거
-- 개인키는 오직 Edge Function (service_role)에서만 접근해야 함
-- 이 정책을 제거해도 모든 Edge Function은 service_role로 RLS를 우회하므로 기능에 영향 없음

DROP POLICY IF EXISTS "Admins can view private keys" ON public.wallet_private_keys;