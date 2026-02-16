-- Drop existing trigger
DROP TRIGGER IF EXISTS record_wiki_edit_history_trigger ON public.wiki_entries;

-- Recreate the trigger function with metadata-only change exclusion
CREATE OR REPLACE FUNCTION public.record_wiki_edit_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record history if auth.uid() exists (user-initiated changes)
  -- AND if significant fields changed (not just metadata)
  IF auth.uid() IS NOT NULL AND (
    OLD.content IS DISTINCT FROM NEW.content 
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.schema_type IS DISTINCT FROM NEW.schema_type
    OR OLD.is_verified IS DISTINCT FROM NEW.is_verified
  ) THEN
    INSERT INTO public.wiki_edit_history (
      wiki_entry_id,
      editor_id,
      previous_content,
      new_content,
      previous_title,
      new_title,
      previous_image_url,
      new_image_url,
      previous_metadata,
      new_metadata,
      previous_schema_type,
      new_schema_type,
      previous_is_verified,
      new_is_verified
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.content,
      NEW.content,
      OLD.title,
      NEW.title,
      OLD.image_url,
      NEW.image_url,
      OLD.metadata,
      NEW.metadata,
      OLD.schema_type,
      NEW.schema_type,
      OLD.is_verified,
      NEW.is_verified
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER record_wiki_edit_history_trigger
BEFORE UPDATE ON public.wiki_entries
FOR EACH ROW
EXECUTE FUNCTION public.record_wiki_edit_history();