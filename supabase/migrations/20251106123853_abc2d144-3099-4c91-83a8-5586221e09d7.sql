-- BTS 멤버 중복 제거 및 정리

-- 1. J-Hope 중복 제거 (position과 image_url이 있는 것만 남기고 나머지 삭제)
DELETE FROM wiki_entries 
WHERE schema_type = 'member' 
  AND title = 'J-Hope' 
  AND metadata->>'group_id' = '7ed1a3cc-2fd7-42dc-9bba-2c2f1d89f5be'
  AND id != '0d4833ea-278f-41f0-be2e-89f57bd5a581';

-- 2. RM 중복 제거 (position 있는 rm-2만 남김)
DELETE FROM wiki_entries 
WHERE schema_type = 'member' 
  AND title = 'RM' 
  AND metadata->>'group_id' = '7ed1a3cc-2fd7-42dc-9bba-2c2f1d89f5be'
  AND id NOT IN ('2680dd2f-542a-4c8a-9059-7d3d4a577761');

-- 3. V에 position 추가 (image_url 있는 것 선택)
UPDATE wiki_entries 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{position}',
  '"Lead Dancer, Vocalist, Visual"'
)
WHERE id = '60cd1cad-03b6-456c-88ef-a3df173d6cc3';

-- 4. Jungkook에 position과 group_name 추가
UPDATE wiki_entries 
SET metadata = metadata 
  || '{"position": "Main Vocalist, Lead Dancer, Sub Rapper, Center, Maknae", "group_name": "BTS"}'::jsonb
WHERE id = 'b6255db5-62be-4cfa-89ef-c4f5f0debf16';

-- 5. V 중복 제거 (image_url 있는 것만 남김)
DELETE FROM wiki_entries 
WHERE schema_type = 'member' 
  AND title = 'V' 
  AND metadata->>'group_id' = '7ed1a3cc-2fd7-42dc-9bba-2c2f1d89f5be'
  AND id != '60cd1cad-03b6-456c-88ef-a3df173d6cc3';

-- 6. BTS 그룹 엔트리의 metadata.members 제거 (실제 member 엔트리만 사용하도록)
UPDATE wiki_entries 
SET metadata = metadata - 'members'
WHERE id = '7ed1a3cc-2fd7-42dc-9bba-2c2f1d89f5be';