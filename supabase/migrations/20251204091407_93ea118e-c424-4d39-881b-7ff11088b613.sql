-- 포스트 추가/삭제 시 해당 엔트리의 합산점수 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_entry_aggregated_scores_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- INSERT 또는 UPDATE 시
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.wiki_entry_id IS NOT NULL THEN
      PERFORM calculate_aggregated_scores(NEW.wiki_entry_id);
    END IF;
    RETURN NEW;
  END IF;
  
  -- DELETE 시
  IF TG_OP = 'DELETE' THEN
    IF OLD.wiki_entry_id IS NOT NULL THEN
      PERFORM calculate_aggregated_scores(OLD.wiki_entry_id);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- 포스트 테이블에 트리거 추가
DROP TRIGGER IF EXISTS update_entry_aggregated_scores_on_post_trigger ON posts;

CREATE TRIGGER update_entry_aggregated_scores_on_post_trigger
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_entry_aggregated_scores_on_post();