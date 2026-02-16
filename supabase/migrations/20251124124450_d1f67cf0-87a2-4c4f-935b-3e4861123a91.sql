-- wiki_entry_followers 테이블에 RLS 정책 추가
-- 사용자가 자신의 팔로우 목록을 조회할 수 있도록 허용

-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Users can view their own followed entries" ON wiki_entry_followers;
DROP POLICY IF EXISTS "Users can view own followers" ON wiki_entry_followers;

-- 사용자가 자신이 팔로우한 엔트리를 볼 수 있는 정책
CREATE POLICY "Users can view their own followed entries"
ON wiki_entry_followers
FOR SELECT
USING (auth.uid() = user_id);

-- 엔트리의 팔로워 목록은 모두가 볼 수 있도록 (공개 정보)
CREATE POLICY "Everyone can view entry followers"
ON wiki_entry_followers
FOR SELECT
USING (true);