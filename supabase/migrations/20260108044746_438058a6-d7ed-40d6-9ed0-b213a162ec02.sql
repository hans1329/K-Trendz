-- 중복 참여 허용을 위해 unique constraint 제거
ALTER TABLE public.challenge_participations 
DROP CONSTRAINT IF EXISTS challenge_participations_challenge_id_user_id_key;

-- 인덱스는 유지 (쿼리 성능용)
CREATE INDEX IF NOT EXISTS idx_challenge_participations_challenge_user 
ON public.challenge_participations(challenge_id, user_id);

-- 사용자별 참여 횟수 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_participations_user_challenge 
ON public.challenge_participations(user_id, challenge_id);