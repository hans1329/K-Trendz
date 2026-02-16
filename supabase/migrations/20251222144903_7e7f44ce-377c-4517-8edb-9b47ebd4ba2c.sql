
-- 이벤트 투표용 RPC 함수: votes는 ±1, trending_score도 ±1만 반영
CREATE OR REPLACE FUNCTION public.increment_event_vote(
  entry_id_param UUID,
  is_upvote BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vote_change INTEGER;
  score_adjustment INTEGER;
BEGIN
  -- 투표 변경량 계산
  vote_change := CASE WHEN is_upvote THEN 1 ELSE -1 END;
  
  -- 1. votes 업데이트 (트리거가 trending_score를 재계산함 - votes * 8 가중치)
  UPDATE wiki_entries
  SET votes = votes + vote_change
  WHERE id = entry_id_param;
  
  -- 2. 이벤트 투표는 점수 1점만 반영되어야 하므로, 
  --    트리거가 적용한 가중치(votes * 8)에서 차이만큼 보정
  --    보정: 8 - 1 = 7만큼 빼면 결국 1점만 반영됨
  score_adjustment := vote_change * 7;
  
  UPDATE wiki_entries
  SET trending_score = trending_score - score_adjustment
  WHERE id = entry_id_param;
END;
$$;
