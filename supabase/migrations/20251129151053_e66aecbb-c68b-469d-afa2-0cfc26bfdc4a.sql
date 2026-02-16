
-- fanz_tokens 테이블의 SELECT 정책을 모든 사용자(비로그인 포함)에게 허용
DROP POLICY IF EXISTS "Fanz tokens are viewable by everyone" ON public.fanz_tokens;

CREATE POLICY "Fanz tokens are viewable by everyone"
ON public.fanz_tokens
FOR SELECT
TO public  -- authenticated와 anon 모두 포함
USING (true);
