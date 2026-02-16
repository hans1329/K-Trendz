-- Add columns to track all changes in wiki_edit_history
ALTER TABLE public.wiki_edit_history
ADD COLUMN previous_image_url text,
ADD COLUMN new_image_url text,
ADD COLUMN previous_metadata jsonb,
ADD COLUMN new_metadata jsonb,
ADD COLUMN previous_schema_type wiki_schema_type,
ADD COLUMN new_schema_type wiki_schema_type,
ADD COLUMN previous_is_verified boolean,
ADD COLUMN new_is_verified boolean;

-- Update the record_wiki_edit_history function to track all changes
CREATE OR REPLACE FUNCTION public.record_wiki_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 모든 주요 필드 변경사항을 기록
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
$function$;

-- Add RLS policy for admins to delete edit history
CREATE POLICY "Admins can delete edit history"
ON public.wiki_edit_history
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));