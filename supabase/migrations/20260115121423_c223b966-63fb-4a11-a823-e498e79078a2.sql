-- 중복 함수 삭제: target_id_param, target_type_param 순서가 다른 버전 삭제
DROP FUNCTION IF EXISTS public.check_and_increment_vote_count(uuid, uuid, text);

-- 올바른 버전만 유지 (user_id_param, target_type_param, target_id_param 순서)