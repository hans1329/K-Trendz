-- search_path 수정: calculate_vote_weight 함수
CREATE OR REPLACE FUNCTION public.calculate_vote_weight(lightstick_count INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lightstick_count >= 100 THEN 5  -- Diamond
    WHEN lightstick_count >= 50 THEN 4   -- Gold
    WHEN lightstick_count >= 20 THEN 3   -- Silver
    WHEN lightstick_count >= 5 THEN 2    -- Bronze
    WHEN lightstick_count >= 1 THEN 1    -- Basic
    ELSE 0                                -- No lightstick
  END;
$$;