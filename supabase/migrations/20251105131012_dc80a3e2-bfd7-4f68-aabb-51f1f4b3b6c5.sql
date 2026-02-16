-- RPC 함수 생성: 실제 엔트리가 있는 스키마 타입만 반환
CREATE OR REPLACE FUNCTION get_schema_types_with_entries()
RETURNS TABLE (schema_type wiki_schema_type) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT we.schema_type
  FROM wiki_entries we
  WHERE we.content IS NOT NULL 
    AND we.content != ''
    AND we.content NOT ILIKE '%Pending AI content generation%'
  ORDER BY we.schema_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;