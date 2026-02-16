-- BTS 그룹의 ID를 변수로 저장
DO $$
DECLARE
  bts_group_id UUID;
BEGIN
  -- BTS 그룹 엔트리의 ID 찾기
  SELECT id INTO bts_group_id
  FROM wiki_entries
  WHERE schema_type = 'artist' AND title = 'BTS'
  LIMIT 1;
  
  -- BTS 멤버들의 metadata에 group_id 추가
  IF bts_group_id IS NOT NULL THEN
    UPDATE wiki_entries
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{group_id}',
      to_jsonb(bts_group_id::text)
    )
    WHERE schema_type = 'member' 
      AND (
        metadata->>'group_name' ILIKE '%BTS%'
        OR title IN ('Jimin', 'RM', 'Suga', 'Jin', 'J-Hope', 'V', 'Jungkook')
      )
      AND (metadata->>'group_id' IS NULL OR metadata->>'group_id' = '');
    
    RAISE NOTICE 'Updated BTS members with group_id: %', bts_group_id;
  ELSE
    RAISE NOTICE 'BTS group entry not found';
  END IF;
END $$;