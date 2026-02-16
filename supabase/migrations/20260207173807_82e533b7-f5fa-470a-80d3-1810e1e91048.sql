-- 관리자가 모든 USDC 거래를 조회할 수 있도록 RLS 정책 추가
CREATE POLICY "Admins can view all USDC transactions"
ON public.usdc_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);