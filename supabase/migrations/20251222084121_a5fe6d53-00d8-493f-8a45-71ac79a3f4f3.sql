-- Fix: set immutable search_path for security definer functions (database linter 0011)

CREATE OR REPLACE FUNCTION public.add_wiki_schema_type_if_not_exists(new_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.deduct_points_for_wiki_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  wiki_create_points INTEGER;
  user_available_points INTEGER;
BEGIN
  -- Skip point deduction for auto-generated verified entries
  IF NEW.is_verified = true THEN
    RETURN NEW;
  END IF;

  -- Get the point cost for wiki creation
  SELECT points INTO wiki_create_points
  FROM point_rules
  WHERE action_type = 'wiki_create' AND is_active = true
  LIMIT 1;

  -- If no rule found, allow creation
  IF wiki_create_points IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's available points
  SELECT available_points INTO user_available_points
  FROM profiles
  WHERE id = NEW.creator_id;

  -- Check if user has enough points (only for negative point costs)
  IF wiki_create_points < 0 AND user_available_points < ABS(wiki_create_points) THEN
    RAISE EXCEPTION 'Insufficient points to create wiki entry';
  END IF;

  -- Deduct or award points
  UPDATE profiles
  SET available_points = available_points + wiki_create_points
  WHERE id = NEW.creator_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_birthday_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.calculate_fanz_token_price(token_id_param uuid, supply_param bigint DEFAULT NULL::bigint)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  token_record RECORD;
  current_supply BIGINT;
  sqrt_supply_plus_c NUMERIC;
  offset_value NUMERIC := 3; -- sqrt(9)
BEGIN
  SELECT base_price, k_value, total_supply
  INTO token_record
  FROM fanz_tokens
  WHERE id = token_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  
  current_supply := COALESCE(supply_param, token_record.total_supply);
  
  -- P(s) = basePrice + k * (sqrt(s + 9) - 3)
  sqrt_supply_plus_c := SQRT(current_supply + 9);
  
  IF sqrt_supply_plus_c <= offset_value THEN
    RETURN token_record.base_price;
  END IF;
  
  RETURN token_record.base_price + (token_record.k_value * (sqrt_supply_plus_c - offset_value));
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_evaluate_ai_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  quality_score INTEGER;
  min_votes INTEGER;
  min_views INTEGER;
  min_content_length INTEGER;
  content_length INTEGER;
  already_registered BOOLEAN;
BEGIN
  -- 포스트인 경우
  IF TG_TABLE_NAME = 'posts' THEN
    min_votes := 10;
    min_views := 50;
    min_content_length := 100;
    content_length := LENGTH(NEW.content);
    
    -- 승인되지 않은 포스트는 제외
    IF NEW.is_approved = false THEN
      RETURN NEW;
    END IF;
    
    -- 이미 등록되어 있는지 확인
    SELECT EXISTS (
      SELECT 1 FROM ai_data_contributions
      WHERE content_id = NEW.id AND content_type = 'post'
    ) INTO already_registered;
    
    -- 기준 충족 및 미등록 시 평가
    IF NOT already_registered 
       AND NEW.votes >= min_votes 
       AND NEW.view_count >= min_views 
       AND content_length >= min_content_length THEN
      
      -- 품질 점수 계산 (0-100)
      quality_score := LEAST(
        ROUND((NEW.votes::NUMERIC / min_votes) * 40) +
        ROUND((NEW.view_count::NUMERIC / min_views) * 30) +
        ROUND((content_length::NUMERIC / min_content_length) * 30),
        100
      );
      
      -- 품질 점수 60 이상만 등록
      IF quality_score >= 60 THEN
        -- AI 데이터 기여 등록
        INSERT INTO ai_data_contributions (
          user_id,
          content_type,
          content_id,
          contribution_quality_score,
          used_in_training
        ) VALUES (
          NEW.user_id,
          'post',
          NEW.id,
          quality_score,
          false
        );
        
        -- 포인트 지급
        PERFORM award_points(NEW.user_id, 'ai_data_accepted', NEW.id);
        
        -- 고품질 보너스 (80점 이상)
        IF quality_score >= 80 THEN
          PERFORM award_points(NEW.user_id, 'ai_data_high_quality', NEW.id);
        END IF;
        
        RAISE NOTICE 'AI contribution registered for post % with quality score %', NEW.id, quality_score;
      END IF;
    END IF;
  
  -- 위키 엔트리인 경우
  ELSIF TG_TABLE_NAME = 'wiki_entries' THEN
    min_votes := 5;
    min_views := 100;
    min_content_length := 200;
    content_length := LENGTH(NEW.content);
    
    -- 검증되지 않은 엔트리는 제외
    IF NEW.is_verified = false THEN
      RETURN NEW;
    END IF;
    
    -- 이미 등록되어 있는지 확인
    SELECT EXISTS (
      SELECT 1 FROM ai_data_contributions
      WHERE content_id = NEW.id AND content_type = 'wiki_entry'
    ) INTO already_registered;
    
    -- 기준 충족 및 미등록 시 평가
    IF NOT already_registered 
       AND NEW.votes >= min_votes 
       AND NEW.view_count >= min_views 
       AND content_length >= min_content_length THEN
      
      -- 품질 점수 계산 (0-100)
      quality_score := LEAST(
        ROUND((NEW.votes::NUMERIC / min_votes) * 40) +
        ROUND((NEW.view_count::NUMERIC / min_views) * 30) +
        ROUND((content_length::NUMERIC / min_content_length) * 30),
        100
      );
      
      -- 품질 점수 60 이상만 등록
      IF quality_score >= 60 THEN
        -- AI 데이터 기여 등록
        INSERT INTO ai_data_contributions (
          user_id,
          content_type,
          content_id,
          contribution_quality_score,
          used_in_training
        ) VALUES (
          NEW.creator_id,
          'wiki_entry',
          NEW.id,
          quality_score,
          false
        );
        
        -- 포인트 지급
        PERFORM award_points(NEW.creator_id, 'ai_data_accepted', NEW.id);
        
        -- 고품질 보너스 (80점 이상)
        IF quality_score >= 80 THEN
          PERFORM award_points(NEW.creator_id, 'ai_data_high_quality', NEW.id);
        END IF;
        
        RAISE NOTICE 'AI contribution registered for wiki entry % with quality score %', NEW.id, quality_score;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_wiki_entry_view_count(entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- updated_at 트리거를 우회하기 위해 직접 SQL 실행
  UPDATE wiki_entries 
  SET view_count = view_count + 1
  WHERE id = entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_schema_types_with_entries()
RETURNS TABLE(schema_type wiki_schema_type)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT we.schema_type
  FROM wiki_entries we
  WHERE we.content IS NOT NULL 
    AND we.content != ''
    AND we.content NOT ILIKE '%Pending AI content generation%'
  ORDER BY we.schema_type;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code TEXT;
  remaining INT;
  current_user_id UUID;
  is_user_vip BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  -- VIP 여부 확인
  SELECT is_vip INTO is_user_vip FROM profiles WHERE id = current_user_id;
  
  -- VIP가 아닌 경우 남은 코드 수 확인
  IF NOT COALESCE(is_user_vip, false) THEN
    SELECT get_remaining_invitation_codes(current_user_id) INTO remaining;
    IF remaining <= 0 THEN
      RETURN NULL;
    END IF;
  END IF;
  
  -- 6자리 고유 코드 생성
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invitation_codes WHERE code = new_code);
  END LOOP;
  
  -- 코드 저장
  INSERT INTO invitation_codes (code, creator_id)
  VALUES (new_code, current_user_id);
  
  RETURN new_code;
END;
$function$;