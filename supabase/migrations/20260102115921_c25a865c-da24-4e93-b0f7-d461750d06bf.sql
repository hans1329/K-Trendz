-- 제안 삭제 정책 추가: 관리자 또는 제안자 본인만 삭제 가능
CREATE POLICY "Admins and proposers can delete proposals" 
ON public.support_proposals 
FOR DELETE 
USING (
  auth.uid() = proposer_id OR 
  has_role(auth.uid(), 'admin'::app_role)
);