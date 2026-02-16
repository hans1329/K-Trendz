
-- 밴 유저가 자신의 밴 레코드를 조회할 수 있도록 RLS 정책 추가
CREATE POLICY "Users can check their own ban status"
ON public.user_bans
FOR SELECT
USING (auth.uid() = user_id);
