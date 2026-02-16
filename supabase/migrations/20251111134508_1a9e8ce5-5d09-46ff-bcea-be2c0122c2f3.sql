
-- Add security definer and search_path to the new function
CREATE OR REPLACE FUNCTION public.update_wiki_entries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update updated_at if user-facing content has changed
  -- Skip automated fields: view_count, trending_score, votes, likes_count, 
  -- follower_count, aggregated_*, last_edited_at, last_edited_by
  IF (
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.slug IS DISTINCT FROM NEW.slug
    OR OLD.content IS DISTINCT FROM NEW.content
    OR OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.og_image_url IS DISTINCT FROM NEW.og_image_url
    OR OLD.schema_type IS DISTINCT FROM NEW.schema_type
    OR OLD.is_verified IS DISTINCT FROM NEW.is_verified
    OR OLD.is_pinned IS DISTINCT FROM NEW.is_pinned
    OR OLD.is_boosted IS DISTINCT FROM NEW.is_boosted
    OR OLD.metadata IS DISTINCT FROM NEW.metadata
    OR OLD.real_name IS DISTINCT FROM NEW.real_name
    OR OLD.birth_date IS DISTINCT FROM NEW.birth_date
    OR OLD.gender IS DISTINCT FROM NEW.gender
    OR OLD.nationality IS DISTINCT FROM NEW.nationality
    OR OLD.blood_type IS DISTINCT FROM NEW.blood_type
    OR OLD.height IS DISTINCT FROM NEW.height
    OR OLD.weight IS DISTINCT FROM NEW.weight
  ) THEN
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$function$;
