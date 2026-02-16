-- Wiki 엔트리 생성 시 자동으로 creator를 팔로워로 추가하고 entry_agent 역할 부여하는 함수
CREATE OR REPLACE FUNCTION auto_follow_and_assign_role_on_wiki_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 생성자를 자동으로 팔로워로 추가
  INSERT INTO wiki_entry_followers (user_id, wiki_entry_id)
  VALUES (NEW.creator_id, NEW.id)
  ON CONFLICT (user_id, wiki_entry_id) DO NOTHING;
  
  -- 생성자에게 entry_agent 역할 부여
  INSERT INTO wiki_entry_roles (user_id, wiki_entry_id, role)
  VALUES (NEW.creator_id, NEW.id, 'entry_agent')
  ON CONFLICT (user_id, wiki_entry_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_wiki_entry_created ON wiki_entries;
CREATE TRIGGER on_wiki_entry_created
  AFTER INSERT ON wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_follow_and_assign_role_on_wiki_create();