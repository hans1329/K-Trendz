-- fanz_tokens 테이블에 관리자 삭제 정책 추가
CREATE POLICY "Admins can delete fanz tokens"
ON public.fanz_tokens
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));