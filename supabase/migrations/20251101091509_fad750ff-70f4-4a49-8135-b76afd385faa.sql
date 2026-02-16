-- 차단 및 신고 기능을 위한 테이블 생성

-- 차단된 사용자 테이블
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_user_id),
  CONSTRAINT different_users_block CHECK (user_id != blocked_user_id)
);

-- 사용자 신고 테이블
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT different_users_report CHECK (reporter_id != reported_user_id)
);

-- RLS 활성화
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Blocked Users RLS 정책
-- 사용자는 자신이 차단한 목록만 볼 수 있음
CREATE POLICY "Users can view their own blocked list"
ON public.blocked_users
FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 다른 사용자를 차단할 수 있음
CREATE POLICY "Users can block other users"
ON public.blocked_users
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 차단을 해제할 수 있음
CREATE POLICY "Users can unblock users"
ON public.blocked_users
FOR DELETE
USING (auth.uid() = user_id);

-- User Reports RLS 정책
-- 사용자는 자신이 작성한 신고만 볼 수 있음
CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- 사용자는 다른 사용자를 신고할 수 있음
CREATE POLICY "Users can report other users"
ON public.user_reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- 인덱스 생성
CREATE INDEX idx_blocked_users_user_id ON public.blocked_users(user_id);
CREATE INDEX idx_blocked_users_blocked_user_id ON public.blocked_users(blocked_user_id);
CREATE INDEX idx_user_reports_reporter_id ON public.user_reports(reporter_id);
CREATE INDEX idx_user_reports_reported_user_id ON public.user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);