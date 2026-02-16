-- 기존 정책 삭제
DROP POLICY IF EXISTS "Creators can view their own earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "Admins can view all earnings" ON public.creator_earnings;

-- 생성자는 자신의 수익을 볼 수 있음
CREATE POLICY "Creators can view their own earnings"
ON public.creator_earnings
FOR SELECT
USING (auth.uid() = creator_id);

-- 관리자는 모든 수익을 볼 수 있음
CREATE POLICY "Admins can view all earnings"
ON public.creator_earnings
FOR SELECT
USING (has_role(auth.uid(), 'admin'));