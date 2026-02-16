-- Wiki 엔트리 역할 부여 시 자동으로 팔로워로 추가하는 함수
CREATE OR REPLACE FUNCTION auto_follow_on_role_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 역할을 받은 사용자를 자동으로 팔로워로 추가
  INSERT INTO wiki_entry_followers (user_id, wiki_entry_id)
  VALUES (NEW.user_id, NEW.wiki_entry_id)
  ON CONFLICT (user_id, wiki_entry_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_wiki_entry_role_assigned ON wiki_entry_roles;
CREATE TRIGGER on_wiki_entry_role_assigned
  AFTER INSERT ON wiki_entry_roles
  FOR EACH ROW
  EXECUTE FUNCTION auto_follow_on_role_assign();