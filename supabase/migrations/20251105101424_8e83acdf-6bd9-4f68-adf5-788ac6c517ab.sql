-- RPC 함수 생성: 포스트 조회수 증가
CREATE OR REPLACE FUNCTION public.increment_post_view_count(post_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = post_id_param;
END;
$$;