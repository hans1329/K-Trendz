-- 1. support_proposals 테이블에 min_lightstick_required 컬럼 추가
ALTER TABLE public.support_proposals 
ADD COLUMN min_lightstick_required integer NOT NULL DEFAULT 0;

-- 2. 기존 이름 정하기 제안들의 min_lightstick_required를 0으로 설정 (이미 default 0이지만 명시적으로)
UPDATE public.support_proposals 
SET min_lightstick_required = 0 
WHERE proposal_category = 'community_naming';

-- 3. 기존 support_proposal_opinions RLS 정책 삭제 후 새 정책 생성
DROP POLICY IF EXISTS "Lightstick holders can create opinions" ON public.support_proposal_opinions;

-- 4. 새 RLS 정책: min_lightstick_required 조건에 따라 참여 가능
CREATE POLICY "Users can create opinions based on proposal requirements" 
  ON public.support_proposal_opinions FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- min_lightstick_required가 0이면 누구나 참여 가능
      EXISTS (
        SELECT 1 FROM public.support_proposals sp
        WHERE sp.id = proposal_id
          AND sp.min_lightstick_required = 0
      )
      OR
      -- min_lightstick_required > 0이면 해당 수량 이상 보유 필요
      EXISTS (
        SELECT 1 FROM public.fanz_balances fb
        JOIN public.fanz_tokens ft ON fb.fanz_token_id = ft.id
        JOIN public.support_proposals sp ON sp.wiki_entry_id = ft.wiki_entry_id
        WHERE sp.id = proposal_id
          AND fb.user_id = auth.uid()
          AND fb.balance >= sp.min_lightstick_required
      )
    )
  );

-- 5. proposal_chat_messages RLS 정책도 동일하게 수정
DROP POLICY IF EXISTS "Lightstick holders can send chat messages" ON public.proposal_chat_messages;

CREATE POLICY "Users can send chat messages based on proposal requirements" 
  ON public.proposal_chat_messages FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- min_lightstick_required가 0이면 누구나 참여 가능
      EXISTS (
        SELECT 1 FROM public.support_proposals sp
        WHERE sp.id = proposal_id
          AND sp.min_lightstick_required = 0
      )
      OR
      -- min_lightstick_required > 0이면 해당 수량 이상 보유 필요
      EXISTS (
        SELECT 1 FROM public.fanz_balances fb
        JOIN public.fanz_tokens ft ON fb.fanz_token_id = ft.id
        JOIN public.support_proposals sp ON sp.wiki_entry_id = ft.wiki_entry_id
        WHERE sp.id = proposal_id
          AND fb.user_id = auth.uid()
          AND fb.balance >= sp.min_lightstick_required
      )
    )
  );