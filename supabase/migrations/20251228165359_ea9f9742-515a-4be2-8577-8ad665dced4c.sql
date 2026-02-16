-- 사용자가 자신의 참여를 삭제할 수 있도록 DELETE 정책 추가
CREATE POLICY "Users can delete their own participations"
ON public.challenge_participations
FOR DELETE
USING (auth.uid() = user_id);