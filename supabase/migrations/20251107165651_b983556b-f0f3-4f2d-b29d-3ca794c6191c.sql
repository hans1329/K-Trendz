-- wiki_entries 테이블에서 "not found" 문자열을 null로 정리
UPDATE wiki_entries
SET 
  real_name = CASE WHEN real_name IN ('not found', 'N/A', 'null') THEN NULL ELSE real_name END,
  birth_date = CASE WHEN birth_date::text IN ('not found', 'N/A', 'null') THEN NULL ELSE birth_date END,
  gender = CASE WHEN gender IN ('not found', 'N/A', 'null') THEN NULL ELSE gender END,
  nationality = CASE WHEN nationality IN ('not found', 'N/A', 'null') THEN NULL ELSE nationality END,
  blood_type = CASE WHEN blood_type IN ('not found', 'N/A', 'null') THEN NULL ELSE blood_type END,
  height = CASE WHEN height::text IN ('not found', 'N/A', 'null') THEN NULL ELSE height END,
  weight = CASE WHEN weight::text IN ('not found', 'N/A', 'null') THEN NULL ELSE weight END
WHERE 
  real_name IN ('not found', 'N/A', 'null')
  OR birth_date::text IN ('not found', 'N/A', 'null')
  OR gender IN ('not found', 'N/A', 'null')
  OR nationality IN ('not found', 'N/A', 'null')
  OR blood_type IN ('not found', 'N/A', 'null')
  OR height::text IN ('not found', 'N/A', 'null')
  OR weight::text IN ('not found', 'N/A', 'null');