-- 기존 DELETE 정책 삭제
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- 관리자와 모더레이터도 삭제할 수 있도록 새 정책 생성
CREATE POLICY "Users and admins can delete posts" 
ON public.posts 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'moderator'::app_role)
);