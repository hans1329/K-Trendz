-- 포스트 투표도 엔트리처럼 24시간 후 재투표 가능하도록 수정
-- check_and_increment_vote_count 함수의 post 투표 중복 체크 로직 변경

CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(
  user_id_param UUID,
  target_type_param TEXT DEFAULT 'entry',
  target_id_param TEXT DEFAULT NULL
)
RETURNS TABLE(
  can_vote BOOLEAN,
  is_first_vote_today BOOLEAN,
  remaining_votes INTEGER,
  current_level INTEGER,
  max_votes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_level INTEGER;
  max_daily_votes INTEGER;
  current_vote_count INTEGER;
  vote_exists BOOLEAN;
  new_votes INTEGER;
  today_date DATE := CURRENT_DATE;
  bonus_points INTEGER;
BEGIN
  -- 사용자 레벨 및 최대 투표수 조회
  SELECT p.current_level, l.max_daily_votes
  INTO user_level, max_daily_votes
  FROM profiles p
  JOIN levels l ON l.id = p.current_level
  WHERE p.id = user_id_param;

  IF user_level IS NULL THEN
    user_level := 1;
    max_daily_votes := 10;
  END IF;

  -- 오늘 사용한 투표수 조회
  SELECT COALESCE(vote_count, 0)
  INTO current_vote_count
  FROM daily_vote_counts
  WHERE user_id = user_id_param
    AND vote_date = today_date;

  IF current_vote_count IS NULL THEN
    current_vote_count := 0;
  END IF;

  -- 타겟별 24시간 내 중복 투표 체크 (엔트리와 포스트 모두 동일하게 24시간 기준)
  IF target_type_param = 'entry' AND target_id_param IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM wiki_entry_votes
      WHERE user_id = user_id_param
        AND wiki_entry_id = target_id_param::UUID
        AND created_at > NOW() - INTERVAL '24 hours'
    ) INTO vote_exists;
  ELSIF target_type_param = 'post' AND target_id_param IS NOT NULL THEN
    -- 포스트도 24시간 기준으로 변경
    SELECT EXISTS(
      SELECT 1 FROM post_votes
      WHERE user_id = user_id_param
        AND post_id = target_id_param::UUID
        AND created_at > NOW() - INTERVAL '24 hours'
    ) INTO vote_exists;
  ELSE
    vote_exists := FALSE;
  END IF;

  -- 투표 가능 여부 확인
  IF current_vote_count >= max_daily_votes THEN
    RETURN QUERY SELECT FALSE, NOT vote_exists, 0, user_level, max_daily_votes;
    RETURN;
  END IF;

  IF vote_exists THEN
    RETURN QUERY SELECT FALSE, FALSE, (max_daily_votes - current_vote_count)::INTEGER, user_level, max_daily_votes;
    RETURN;
  END IF;

  -- 투표 카운트 증가
  INSERT INTO daily_vote_counts (user_id, vote_date, vote_count)
  VALUES (user_id_param, today_date, 1)
  ON CONFLICT (user_id, vote_date)
  DO UPDATE SET vote_count = daily_vote_counts.vote_count + 1, updated_at = NOW();

  new_votes := current_vote_count + 1;

  -- 일일 투표 완료 보너스 지급
  IF new_votes = max_daily_votes THEN
    SELECT COALESCE(points, 5) INTO bonus_points
    FROM point_rules
    WHERE action_type = 'daily_vote_completion' AND is_active = TRUE
    LIMIT 1;

    IF bonus_points IS NULL THEN
      bonus_points := 5;
    END IF;

    -- 보너스 포인트 지급
    PERFORM set_config('app.bypass_points_protection', 'true', true);
    
    INSERT INTO point_transactions (user_id, action_type, points, reference_id)
    VALUES (user_id_param, 'daily_vote_completion', bonus_points, NULL::uuid);

    UPDATE profiles
    SET available_points = available_points + bonus_points,
        total_points = total_points + bonus_points,
        updated_at = NOW()
    WHERE id = user_id_param;
  END IF;

  RETURN QUERY SELECT TRUE, TRUE, (max_daily_votes - new_votes)::INTEGER, user_level, max_daily_votes;
END;
$$;