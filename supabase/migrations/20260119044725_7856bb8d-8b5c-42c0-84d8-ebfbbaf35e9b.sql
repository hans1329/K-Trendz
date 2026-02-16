-- 기존 UUID 버전 함수 삭제 (TEXT 버전만 유지)
DROP FUNCTION IF EXISTS public.check_and_increment_vote_count(UUID, TEXT, UUID);