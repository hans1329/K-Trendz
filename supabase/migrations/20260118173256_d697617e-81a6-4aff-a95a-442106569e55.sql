-- Farcaster Mini App 테스트 챌린지 접근을 위해 'test' 상태도 공개 조회 허용
-- 주의: /challenges 목록은 프론트에서 계속 'test'를 필터링하여 숨김 처리함

DROP POLICY IF EXISTS "Anyone can view challenges" ON public.challenges;

CREATE POLICY "Anyone can view challenges"
ON public.challenges
FOR SELECT
TO public
USING (
  (status = ANY (ARRAY['active'::text, 'ended'::text, 'approved'::text, 'cancelled'::text, 'test'::text]))
  OR has_role(auth.uid(), 'admin'::app_role)
);
