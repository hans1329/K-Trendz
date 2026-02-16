-- 기존 wiki 엔트리들의 생성자를 자동으로 팔로워와 entry_agent로 추가
INSERT INTO wiki_entry_followers (user_id, wiki_entry_id)
SELECT creator_id, id
FROM wiki_entries
WHERE NOT EXISTS (
  SELECT 1 FROM wiki_entry_followers
  WHERE user_id = wiki_entries.creator_id
  AND wiki_entry_id = wiki_entries.id
);

INSERT INTO wiki_entry_roles (user_id, wiki_entry_id, role)
SELECT creator_id, id, 'entry_agent'
FROM wiki_entries
WHERE NOT EXISTS (
  SELECT 1 FROM wiki_entry_roles
  WHERE user_id = wiki_entries.creator_id
  AND wiki_entry_id = wiki_entries.id
  AND role = 'entry_agent'
);