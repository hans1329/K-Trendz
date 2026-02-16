-- wiki_entries의 생일을 calendar_events에 자동 동기화하는 함수 생성
CREATE OR REPLACE FUNCTION sync_birthday_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  birthday_date date;
  current_year integer;
BEGIN
  -- actor 또는 member 타입이고 metadata에 birthday가 있는 경우만 처리
  IF (NEW.schema_type = 'actor' OR NEW.schema_type = 'member') AND 
     NEW.metadata ? 'birthday' AND 
     NEW.metadata->>'birthday' IS NOT NULL AND
     NEW.metadata->>'birthday' != '' THEN
    
    -- 생일 날짜 파싱 (YYYY-MM-DD 형식)
    BEGIN
      birthday_date := (NEW.metadata->>'birthday')::date;
      current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
      
      -- 기존 생일 이벤트가 있는지 확인 후 삭제
      DELETE FROM calendar_events 
      WHERE wiki_entry_id = NEW.id 
      AND event_type = 'birthday';
      
      -- 새로운 생일 이벤트 생성 (올해 생일)
      INSERT INTO calendar_events (
        title,
        description,
        event_date,
        event_type,
        creator_id,
        wiki_entry_id,
        is_recurring,
        metadata
      ) VALUES (
        NEW.title || '''s Birthday',
        'Birthday of ' || NEW.title,
        make_date(current_year, EXTRACT(MONTH FROM birthday_date)::integer, EXTRACT(DAY FROM birthday_date)::integer),
        'birthday',
        NEW.creator_id,
        NEW.id,
        true,
        jsonb_build_object('birth_date', NEW.metadata->>'birthday')
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- 날짜 파싱 오류 시 무시
      NULL;
    END;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- 생일 정보가 삭제되었거나 타입이 변경된 경우 calendar_event 삭제
    DELETE FROM calendar_events 
    WHERE wiki_entry_id = NEW.id 
    AND event_type = 'birthday';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (INSERT 및 UPDATE 시 실행)
DROP TRIGGER IF EXISTS sync_birthday_calendar_trigger ON wiki_entries;
CREATE TRIGGER sync_birthday_calendar_trigger
AFTER INSERT OR UPDATE ON wiki_entries
FOR EACH ROW
EXECUTE FUNCTION sync_birthday_to_calendar();

-- 기존 wiki_entries의 생일 데이터를 calendar_events에 동기화
INSERT INTO calendar_events (
  title,
  description,
  event_date,
  event_type,
  creator_id,
  wiki_entry_id,
  is_recurring,
  metadata
)
SELECT 
  w.title || '''s Birthday',
  'Birthday of ' || w.title,
  make_date(
    EXTRACT(YEAR FROM CURRENT_DATE)::integer,
    EXTRACT(MONTH FROM (w.metadata->>'birthday')::date)::integer,
    EXTRACT(DAY FROM (w.metadata->>'birthday')::date)::integer
  ),
  'birthday',
  w.creator_id,
  w.id,
  true,
  jsonb_build_object('birth_date', w.metadata->>'birthday')
FROM wiki_entries w
WHERE (w.schema_type = 'actor' OR w.schema_type = 'member')
  AND w.metadata ? 'birthday'
  AND w.metadata->>'birthday' IS NOT NULL
  AND w.metadata->>'birthday' != ''
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce 
    WHERE ce.wiki_entry_id = w.id 
    AND ce.event_type = 'birthday'
  )
ON CONFLICT DO NOTHING;