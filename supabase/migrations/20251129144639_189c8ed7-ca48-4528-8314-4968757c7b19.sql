-- wiki_entry_followers 테이블의 INSERT 정책 수정
DROP POLICY IF EXISTS "Users can insert their own follows" ON wiki_entry_followers;

CREATE POLICY "Authenticated users can follow entries"
ON wiki_entry_followers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);