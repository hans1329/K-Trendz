-- wiki_schema_type enum에 새 값 추가하는 함수
CREATE OR REPLACE FUNCTION public.add_wiki_schema_type_if_not_exists(new_value TEXT)
RETURNS VOID AS $$
BEGIN
  -- enum 값이 이미 존재하는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'wiki_schema_type'::regtype 
    AND enumlabel = new_value
  ) THEN
    -- ALTER TYPE으로 enum 값 추가
    EXECUTE format('ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS %L', new_value);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 wiki_categories에 있는 값들 중 enum에 없는 것들 확인 및 추가
-- culturetrend 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'wiki_schema_type'::regtype 
    AND enumlabel = 'culturetrend'
  ) THEN
    ALTER TYPE wiki_schema_type ADD VALUE 'culturetrend';
  END IF;
END $$;