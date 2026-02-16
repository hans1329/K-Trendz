
-- text 오버로드 제거하여 ambiguity 해결
DROP FUNCTION IF EXISTS public.deduct_points(uuid, text, text);
