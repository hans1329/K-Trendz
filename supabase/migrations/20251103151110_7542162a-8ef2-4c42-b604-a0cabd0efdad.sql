-- Update the record_wiki_edit_history function to track all field changes
CREATE OR REPLACE FUNCTION public.record_wiki_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 모든 주요 필드 변경사항을 기록 (content, title, image_url, metadata, schema_type, is_verified)
  IF OLD.content IS DISTINCT FROM NEW.content 
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.metadata IS DISTINCT FROM NEW.metadata
    OR OLD.schema_type IS DISTINCT FROM NEW.schema_type
    OR OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
    
    INSERT INTO public.wiki_edit_history (
      wiki_entry_id,
      editor_id,
      previous_content,
      new_content,
      previous_title,
      new_title
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.content,
      NEW.content,
      OLD.title,
      NEW.title
    );
  END IF;
  
  RETURN NEW;
END;
$function$;