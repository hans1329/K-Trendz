-- 외부 지갑 사용자 테이블 (Farcaster + 미래 Base 지갑 로그인)
CREATE TABLE external_wallet_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  
  -- 연결 소스 (확장 가능)
  source TEXT NOT NULL DEFAULT 'farcaster',  -- 'farcaster', 'base_wallet_login', etc.
  fid BIGINT,  -- Farcaster 전용 (nullable)
  
  -- K-Trendz 계정 연결 (선택)
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- 메타데이터
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 같은 소스에서 같은 지갑은 유니크
  UNIQUE(wallet_address, source)
);

-- 외부 지갑 챌린지 참여 테이블
CREATE TABLE external_challenge_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_wallet_id UUID REFERENCES external_wallet_users(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  answer TEXT NOT NULL,
  is_winner BOOLEAN DEFAULT FALSE,
  prize_amount NUMERIC,
  prize_tx_hash TEXT,  -- 직접 전송 TX hash
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 같은 챌린지에 같은 외부 지갑은 1번만 참여
  UNIQUE(external_wallet_id, challenge_id)
);

-- 인덱스 생성
CREATE INDEX idx_external_wallet_users_wallet ON external_wallet_users(wallet_address);
CREATE INDEX idx_external_wallet_users_fid ON external_wallet_users(fid);
CREATE INDEX idx_external_wallet_users_linked ON external_wallet_users(linked_user_id);
CREATE INDEX idx_external_challenge_participations_challenge ON external_challenge_participations(challenge_id);
CREATE INDEX idx_external_challenge_participations_winner ON external_challenge_participations(is_winner) WHERE is_winner = true;

-- RLS 활성화
ALTER TABLE external_wallet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_challenge_participations ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 누구나 조회 가능 (Frame에서 접근)
CREATE POLICY "Anyone can view external wallet users"
ON external_wallet_users FOR SELECT
USING (true);

CREATE POLICY "Anyone can view external challenge participations"
ON external_challenge_participations FOR SELECT
USING (true);

-- RLS 정책: Service role만 생성/수정 가능
CREATE POLICY "Service role can insert external wallet users"
ON external_wallet_users FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update external wallet users"
ON external_wallet_users FOR UPDATE
USING (true);

CREATE POLICY "Service role can insert external challenge participations"
ON external_challenge_participations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update external challenge participations"
ON external_challenge_participations FOR UPDATE
USING (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_external_wallet_users_updated_at
BEFORE UPDATE ON external_wallet_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();