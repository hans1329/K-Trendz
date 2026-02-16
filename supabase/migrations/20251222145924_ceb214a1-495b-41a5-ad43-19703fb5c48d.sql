-- 이벤트 투표로 인한 점수 보정을 누적하기 위한 오프셋 컬럼 추가
ALTER TABLE public.wiki_entries
ADD COLUMN IF NOT EXISTS event_score_offset integer NOT NULL DEFAULT 0;

-- wiki_entries 트렌딩 점수 트리거 함수에 오프셋 반영
CREATE OR REPLACE FUNCTION public.update_wiki_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  badge_score INTEGER;
  fanz_token_score INTEGER;
BEGIN
  -- Calculate badge score
  badge_score := public.calculate_wiki_badge_score(NEW.id);

  -- Calculate fanz token score
  fanz_token_score := public.calculate_fanz_token_score(NEW.id, 'wiki');

  -- Calculate trending score with NEW weights
  -- Votes: 8 (changed from 10)
  -- Follower: 10 (changed from 3)
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 8) +                 -- 투표: 가중치 8
    (COALESCE(NEW.view_count, 0) * 1) +            -- 조회수: 가중치 1
    (COALESCE(NEW.likes_count, 0) * 5) +           -- 좋아요: 가중치 5
    (COALESCE(NEW.follower_count, 0) * 10) +       -- 팔로워: 가중치 10
    (badge_score * 20) +                           -- 뱃지: 가중치 20
    (fanz_token_score * 20) +                      -- Fanz Token: 가중치 20
    COALESCE(NEW.event_score_offset, 0);           -- 이벤트 투표 오프셋(누적 보정)

  RETURN NEW;
END;
$$;

-- 이벤트 투표용 RPC 함수: votes는 vote_delta 만큼, 점수는 vote_delta 만큼만 반영되도록 오프셋 누적
DROP FUNCTION IF EXISTS public.increment_event_vote(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.increment_event_vote(
  entry_id_param UUID,
  vote_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF vote_delta IS NULL OR vote_delta = 0 THEN
    RETURN;
  END IF;

  -- votes 변경 시 트리거가 (votes*8 ...)로 trending_score를 재계산하므로,
  -- event_score_offset에 -(8-1)= -7 * vote_delta 를 누적해 최종 증가분이 vote_delta(=1점/표)가 되도록 보정
  UPDATE public.wiki_entries
  SET 
    votes = votes + vote_delta,
    event_score_offset = event_score_offset - (vote_delta * 7)
  WHERE id = entry_id_param;
END;
$$;