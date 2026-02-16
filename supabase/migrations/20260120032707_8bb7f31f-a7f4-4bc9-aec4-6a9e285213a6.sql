-- external_wallet_users_public 뷰에 wallet_address 추가
-- 기존 뷰 삭제 후 재생성
DROP VIEW IF EXISTS public.external_wallet_users_public;

CREATE VIEW public.external_wallet_users_public
WITH (security_invoker=on) AS
SELECT 
  id,
  wallet_address,  -- 지갑 주소로 조회 가능하도록 추가
  username,
  display_name,
  avatar_url,
  source,
  created_at
FROM public.external_wallet_users;
-- fid, linked_user_id는 민감 정보로 제외

-- 뷰에 대한 SELECT 권한 부여
GRANT SELECT ON public.external_wallet_users_public TO anon, authenticated;