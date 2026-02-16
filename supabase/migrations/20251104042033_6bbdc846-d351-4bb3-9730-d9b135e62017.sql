-- search_path 설정 추가하여 보안 경고 해결
DROP FUNCTION IF EXISTS handle_comment_vote(uuid, uuid, vote_type);

CREATE OR REPLACE FUNCTION handle_comment_vote(
  comment_id_param UUID,
  user_id_param UUID,
  vote_type_param vote_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_vote vote_type;
  vote_diff INTEGER;
BEGIN
  -- 현재 투표 상태 확인
  SELECT vote_type INTO current_vote
  FROM comment_votes
  WHERE comment_id = comment_id_param AND user_id = user_id_param;

  -- 투표 차이 계산
  IF current_vote IS NULL THEN
    -- 새 투표
    vote_diff := CASE WHEN vote_type_param = 'up' THEN 1 ELSE -1 END;
    
    INSERT INTO comment_votes (comment_id, user_id, vote_type)
    VALUES (comment_id_param, user_id_param, vote_type_param);
  ELSIF current_vote = vote_type_param THEN
    -- 같은 투표 클릭 (취소)
    vote_diff := CASE WHEN vote_type_param = 'up' THEN -1 ELSE 1 END;
    
    DELETE FROM comment_votes
    WHERE comment_id = comment_id_param AND user_id = user_id_param;
  ELSE
    -- 다른 투표로 변경
    vote_diff := CASE WHEN vote_type_param = 'up' THEN 2 ELSE -2 END;
    
    UPDATE comment_votes
    SET vote_type = vote_type_param, updated_at = now()
    WHERE comment_id = comment_id_param AND user_id = user_id_param;
  END IF;

  -- comments 테이블의 votes 컬럼 업데이트
  UPDATE comments
  SET votes = votes + vote_diff
  WHERE id = comment_id_param;
END;
$$;