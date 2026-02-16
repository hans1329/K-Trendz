-- 생성자 수익 테이블 생성
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.gift_badges(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  percentage INTEGER NOT NULL DEFAULT 70,
  giver_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- 생성자는 자신의 수익을 볼 수 있음
CREATE POLICY "Creators can view their own earnings"
ON public.creator_earnings
FOR SELECT
USING (auth.uid() = creator_id);

-- 관리자는 모든 수익을 볼 수 있음
CREATE POLICY "Admins can view all earnings"
ON public.creator_earnings
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- 인덱스 생성
CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings(creator_id);
CREATE INDEX idx_creator_earnings_wiki_entry ON public.creator_earnings(wiki_entry_id);
CREATE INDEX idx_creator_earnings_created_at ON public.creator_earnings(created_at DESC);

-- 뱃지가 위키 엔트리에 주어질 때 생성자에게 수익 분배하는 트리거 함수
CREATE OR REPLACE FUNCTION public.distribute_badge_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  entry_creator_id UUID;
  badge_price NUMERIC;
  creator_share NUMERIC;
BEGIN
  -- 위키 엔트리의 생성자 ID 가져오기
  SELECT creator_id INTO entry_creator_id
  FROM public.wiki_entries
  WHERE id = NEW.wiki_entry_id;
  
  -- 뱃지 가격 가져오기
  SELECT usd_price INTO badge_price
  FROM public.gift_badges
  WHERE id = NEW.gift_badge_id;
  
  -- 생성자 몫 계산 (70%)
  creator_share := badge_price * 0.70;
  
  -- 생성자에게 수익 기록
  IF entry_creator_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (
      creator_id,
      wiki_entry_id,
      badge_id,
      amount,
      percentage,
      giver_user_id
    ) VALUES (
      entry_creator_id,
      NEW.wiki_entry_id,
      NEW.gift_badge_id,
      creator_share,
      70,
      NEW.giver_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_distribute_badge_earnings ON public.wiki_entry_gift_badges;
CREATE TRIGGER trigger_distribute_badge_earnings
AFTER INSERT ON public.wiki_entry_gift_badges
FOR EACH ROW
EXECUTE FUNCTION public.distribute_badge_earnings();