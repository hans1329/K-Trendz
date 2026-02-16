-- profiles 테이블에 tebex_wallet_ref 컬럼 추가
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tebex_wallet_ref TEXT;

-- tebex_wallet_ref 컬럼에 주석 추가
COMMENT ON COLUMN profiles.tebex_wallet_ref IS 'Tebex Creator Wallet Reference for revenue sharing';

-- Stripe 관련 컬럼들은 유지 (기존 데이터 보존)
COMMENT ON COLUMN profiles.stripe_account_id IS 'Deprecated: Use tebex_wallet_ref instead';