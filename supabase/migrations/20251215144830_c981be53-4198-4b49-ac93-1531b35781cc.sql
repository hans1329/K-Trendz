-- update_contribution_on_fanz_purchase 트리거 함수 수정 (bigint → integer 캐스팅)
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
      (20 * NEW.amount)::integer, -- bigint를 integer로 캐스팅
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

-- 트리거 생성 (없으면 생성)
DROP TRIGGER IF EXISTS trigger_update_contribution_on_fanz_purchase ON public.fanz_transactions;
CREATE TRIGGER trigger_update_contribution_on_fanz_purchase
  AFTER INSERT ON public.fanz_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contribution_on_fanz_purchase();