-- 기존 user_id unique constraint 삭제 (한 유저가 여러 타입의 지갑을 가질 수 있도록)
ALTER TABLE public.wallet_addresses DROP CONSTRAINT IF EXISTS wallet_addresses_user_id_key;

-- user_id + wallet_type 조합으로 unique constraint 추가
ALTER TABLE public.wallet_addresses 
ADD CONSTRAINT wallet_addresses_user_id_wallet_type_key UNIQUE (user_id, wallet_type);

-- 외부 지갑이 다른 유저에게 이미 연결되어 있으면 중복 방지
-- (wallet_address는 이미 unique 상태이므로 그대로 유지)