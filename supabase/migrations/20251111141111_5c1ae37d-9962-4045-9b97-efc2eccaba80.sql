-- Fix the trigger to properly set last_edited_by
CREATE OR REPLACE FUNCTION public.update_wiki_last_edited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update last_edited_by if user-initiated and significant fields changed
  IF auth.uid() IS NOT NULL AND (
    OLD.content IS DISTINCT FROM NEW.content 
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.schema_type IS DISTINCT FROM NEW.schema_type
    OR OLD.is_verified IS DISTINCT FROM NEW.is_verified
    OR OLD.real_name IS DISTINCT FROM NEW.real_name
    OR OLD.birth_date IS DISTINCT FROM NEW.birth_date
    OR OLD.gender IS DISTINCT FROM NEW.gender
    OR OLD.nationality IS DISTINCT FROM NEW.nationality
    OR OLD.blood_type IS DISTINCT FROM NEW.blood_type
    OR OLD.height IS DISTINCT FROM NEW.height
    OR OLD.weight IS DISTINCT FROM NEW.weight
  ) THEN
    NEW.last_edited_by := auth.uid();
    NEW.last_edited_at := now();
  -- If it's a system update (auth.uid() is null) but fields changed, keep existing last_edited_by
  ELSIF auth.uid() IS NULL AND (
    OLD.content IS DISTINCT FROM NEW.content 
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.schema_type IS DISTINCT FROM NEW.schema_type
    OR OLD.is_verified IS DISTINCT FROM NEW.is_verified
    OR OLD.real_name IS DISTINCT FROM NEW.real_name
    OR OLD.birth_date IS DISTINCT FROM NEW.birth_date
    OR OLD.gender IS DISTINCT FROM NEW.gender
    OR OLD.nationality IS DISTINCT FROM NEW.nationality
    OR OLD.blood_type IS DISTINCT FROM NEW.blood_type
    OR OLD.height IS DISTINCT FROM NEW.height
    OR OLD.weight IS DISTINCT FROM NEW.weight
  ) THEN
    -- Keep existing last_edited_by and update last_edited_at
    NEW.last_edited_at := now();
  END IF;
  
  RETURN NEW;
END;
$function$;