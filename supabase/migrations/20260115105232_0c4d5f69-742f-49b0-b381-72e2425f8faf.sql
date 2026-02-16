-- check_and_increment_vote_count 함수에 daily_vote_completion 보너스 Stars 지급 로직 추가
CREATE OR REPLACE FUNCTION public.check_and_increment_vote_count(
  user_id_param UUID,
  target_type_param TEXT,
  target_id_param UUID
)
RETURNS TABLE (
  can_vote BOOLEAN,
  is_first_vote_today BOOLEAN,
  remaining_votes INTEGER,
  max_votes INTEGER,
  current_level INTEGER,
  completion_rewarded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_votes_local INTEGER;
  current_votes_local INTEGER;
  new_votes_local INTEGER;
  user_level INTEGER;
  already_voted BOOLEAN;
  bonus_points INTEGER;
BEGIN
  -- 포인트 보호 우회 설정
  PERFORM set_config('app.bypass_points_protection', 'true', true);

  -- 사용자 레벨 조회
  SELECT current_level INTO user_level
  FROM profiles
  WHERE id = user_id_param;

  IF user_level IS NULL THEN
    user_level := 1;
  END IF;

  -- 레벨에 따른 최대 투표 수 조회
  SELECT l.max_daily_votes INTO max_votes_local
  FROM levels l
  WHERE l.id = user_level;

  IF max_votes_local IS NULL THEN
    max_votes_local := 10;
  END IF;

  -- 오늘 이미 이 대상에 투표했는지 확인
  IF target_type_param = 'wiki_entry' THEN
    SELECT EXISTS(
      SELECT 1 FROM wiki_votes
      WHERE user_id = user_id_param
        AND wiki_entry_id = target_id_param
        AND DATE(created_at) = CURRENT_DATE
    ) INTO already_voted;
  ELSIF target_type_param = 'post' THEN
    SELECT EXISTS(
      SELECT 1 FROM post_votes
      WHERE user_id = user_id_param
        AND post_id = target_id_param
        AND DATE(created_at) = CURRENT_DATE
    ) INTO already_voted;
  ELSE
    already_voted := FALSE;
  END IF;

  -- 오늘 투표 수 조회
  SELECT COALESCE(vote_count, 0) INTO current_votes_local
  FROM daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;

  IF current_votes_local IS NULL THEN
    current_votes_local := 0;
  END IF;

  -- 이미 투표한 경우
  IF already_voted THEN
    RETURN QUERY SELECT 
      FALSE,
      FALSE,
      (max_votes_local - current_votes_local)::INTEGER,
      max_votes_local,
      user_level,
      FALSE;
    RETURN;
  END IF;

  -- 일일 한도 초과
  IF current_votes_local >= max_votes_local THEN
    RETURN QUERY SELECT 
      FALSE,
      FALSE,
      0::INTEGER,
      max_votes_local,
      user_level,
      FALSE;
    RETURN;
  END IF;

  -- 투표 카운트 증가
  INSERT INTO daily_vote_counts (user_id, vote_date, vote_count)
  VALUES (user_id_param, CURRENT_DATE, 1)
  ON CONFLICT (user_id, vote_date)
  DO UPDATE SET vote_count = daily_vote_counts.vote_count + 1, updated_at = NOW();

  -- 새로운 투표 수 조회
  SELECT vote_count INTO new_votes_local
  FROM daily_vote_counts
  WHERE user_id = user_id_param AND vote_date = CURRENT_DATE;

  -- 일일 투표 완료 시 보너스 Stars 지급
  IF new_votes_local = max_votes_local THEN
    -- point_rules에서 보너스 포인트 조회
    SELECT points INTO bonus_points
    FROM point_rules
    WHERE action_type = 'daily_vote_completion' AND is_active = true;

    IF bonus_points IS NULL THEN
      bonus_points := 5; -- 기본값
    END IF;

    -- point_transactions에 기록
    INSERT INTO point_transactions (user_id, action_type, points, reference_id)
    VALUES (user_id_param, 'daily_vote_completion', bonus_points, NULL::uuid);

    -- profiles 포인트 업데이트
    UPDATE profiles
    SET available_points = available_points + bonus_points,
        total_points = total_points + bonus_points,
        updated_at = NOW()
    WHERE id = user_id_param;

    RETURN QUERY SELECT 
      TRUE,
      TRUE,
      0::INTEGER,
      max_votes_local,
      user_level,
      TRUE;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    TRUE,
    TRUE,
    (max_votes_local - new_votes_local)::INTEGER,
    max_votes_local,
    user_level,
    FALSE;
END;
$$;