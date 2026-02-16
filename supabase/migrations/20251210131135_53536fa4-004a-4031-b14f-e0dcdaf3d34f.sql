-- wiki_entry_user_contributions 테이블에 fanz_tokens_purchased 컬럼 추가
ALTER TABLE public.wiki_entry_user_contributions 
ADD COLUMN IF NOT EXISTS fanz_tokens_purchased integer DEFAULT 0;

-- Fanz Token 구매 시 contribution score 업데이트하는 함수
CREATE OR REPLACE FUNCTION public.update_contribution_on_fanz_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_wiki_entry_id UUID;
BEGIN
  -- buy 트랜잭션만 처리
  IF NEW.transaction_type != 'buy' THEN
    RETURN NEW;
  END IF;
  
  -- fanz_token에서 wiki_entry_id 가져오기
  SELECT wiki_entry_id INTO target_wiki_entry_id
  FROM public.fanz_tokens
  WHERE id = NEW.fanz_token_id;
  
  -- wiki_entry_id가 있는 경우에만 contribution 업데이트
  IF target_wiki_entry_id IS NOT NULL THEN
    PERFORM public.update_wiki_entry_contribution_score(
      target_wiki_entry_id,
      NEW.user_id,
      20 * NEW.amount, -- 토큰당 20점
      0,
      0,
      0
    );
    
    -- fanz_tokens_purchased 카운트 업데이트
    UPDATE public.wiki_entry_user_contributions
    SET fanz_tokens_purchased = fanz_tokens_purchased + NEW.amount
    WHERE wiki_entry_id = target_wiki_entry_id AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- fanz_transactions 테이블에 트리거 추가
DROP TRIGGER IF EXISTS trigger_update_contribution_on_fanz_purchase ON public.fanz_transactions;
CREATE TRIGGER trigger_update_contribution_on_fanz_purchase
  AFTER INSERT ON public.fanz_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contribution_on_fanz_purchase();