-- 1. support_proposals에 proposal_format 컬럼 추가
ALTER TABLE public.support_proposals
ADD COLUMN proposal_format TEXT NOT NULL DEFAULT 'decision'
CHECK (proposal_format IN ('decision', 'discussion'));

-- 2. discussion 타입을 위한 의견 테이블 생성
CREATE TABLE public.support_proposal_opinions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.support_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  opinion TEXT NOT NULL,
  lightstick_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- 3. RLS 활성화
ALTER TABLE public.support_proposal_opinions ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책
CREATE POLICY "Anyone can view opinions"
ON public.support_proposal_opinions FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own opinions"
ON public.support_proposal_opinions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own opinions"
ON public.support_proposal_opinions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opinions"
ON public.support_proposal_opinions FOR DELETE
USING (auth.uid() = user_id);

-- 5. 인덱스
CREATE INDEX idx_support_proposal_opinions_proposal_id ON public.support_proposal_opinions(proposal_id);
CREATE INDEX idx_support_proposal_opinions_user_id ON public.support_proposal_opinions(user_id);