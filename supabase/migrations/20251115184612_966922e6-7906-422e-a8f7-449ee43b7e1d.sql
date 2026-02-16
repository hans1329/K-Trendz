-- AI 데이터 기여도 자동 평가 및 등록 함수
CREATE OR REPLACE FUNCTION auto_evaluate_ai_contribution()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 포스트 업데이트 시 트리거
DROP TRIGGER IF EXISTS trigger_auto_evaluate_post_ai_contribution ON posts;
CREATE TRIGGER trigger_auto_evaluate_post_ai_contribution
  AFTER UPDATE OF votes, view_count ON posts
  FOR EACH ROW
  WHEN (NEW.votes IS DISTINCT FROM OLD.votes OR NEW.view_count IS DISTINCT FROM OLD.view_count)
  EXECUTE FUNCTION auto_evaluate_ai_contribution();

-- 위키 엔트리 업데이트 시 트리거
DROP TRIGGER IF EXISTS trigger_auto_evaluate_wiki_ai_contribution ON wiki_entries;
CREATE TRIGGER trigger_auto_evaluate_wiki_ai_contribution
  AFTER UPDATE OF votes, view_count ON wiki_entries
  FOR EACH ROW
  WHEN (NEW.votes IS DISTINCT FROM OLD.votes OR NEW.view_count IS DISTINCT FROM OLD.view_count)
  EXECUTE FUNCTION auto_evaluate_ai_contribution();

-- 기존 콘텐츠 중 기준 충족하는 것들 일괄 등록 (한 번만 실행)
DO $$
DECLARE
  post_record RECORD;
  wiki_record RECORD;
  quality_score INTEGER;
BEGIN
  -- 포스트 처리
  FOR post_record IN 
    SELECT p.* FROM posts p
    LEFT JOIN ai_data_contributions adc ON adc.content_id = p.id AND adc.content_type = 'post'
    WHERE p.votes >= 10 
      AND p.view_count >= 50 
      AND LENGTH(p.content) >= 100
      AND p.is_approved = true
      AND adc.id IS NULL
  LOOP
    quality_score := LEAST(
      ROUND((post_record.votes::NUMERIC / 10) * 40) +
      ROUND((post_record.view_count::NUMERIC / 50) * 30) +
      ROUND((LENGTH(post_record.content)::NUMERIC / 100) * 30),
      100
    );
    
    IF quality_score >= 60 THEN
      INSERT INTO ai_data_contributions (
        user_id, content_type, content_id, contribution_quality_score, used_in_training
      ) VALUES (
        post_record.user_id, 'post', post_record.id, quality_score, false
      );
      
      PERFORM award_points(post_record.user_id, 'ai_data_accepted', post_record.id);
      
      IF quality_score >= 80 THEN
        PERFORM award_points(post_record.user_id, 'ai_data_high_quality', post_record.id);
      END IF;
    END IF;
  END LOOP;
  
  -- 위키 엔트리 처리
  FOR wiki_record IN 
    SELECT w.* FROM wiki_entries w
    LEFT JOIN ai_data_contributions adc ON adc.content_id = w.id AND adc.content_type = 'wiki_entry'
    WHERE w.votes >= 5 
      AND w.view_count >= 100 
      AND LENGTH(w.content) >= 200
      AND w.is_verified = true
      AND adc.id IS NULL
  LOOP
    quality_score := LEAST(
      ROUND((wiki_record.votes::NUMERIC / 5) * 40) +
      ROUND((wiki_record.view_count::NUMERIC / 100) * 30) +
      ROUND((LENGTH(wiki_record.content)::NUMERIC / 200) * 30),
      100
    );
    
    IF quality_score >= 60 THEN
      INSERT INTO ai_data_contributions (
        user_id, content_type, content_id, contribution_quality_score, used_in_training
      ) VALUES (
        wiki_record.creator_id, 'wiki_entry', wiki_record.id, quality_score, false
      );
      
      PERFORM award_points(wiki_record.creator_id, 'ai_data_accepted', wiki_record.id);
      
      IF quality_score >= 80 THEN
        PERFORM award_points(wiki_record.creator_id, 'ai_data_high_quality', wiki_record.id);
      END IF;
    END IF;
  END LOOP;
END $$;