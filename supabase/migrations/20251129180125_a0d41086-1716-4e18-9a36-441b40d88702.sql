-- fanz_tokens 테이블 읽기 권한 추가 (모든 사용자가 토큰 정보 조회 가능)
CREATE POLICY "Anyone can view fanz tokens"
ON fanz_tokens
FOR SELECT
TO public
USING (true);