
-- Create a specialized function for wiki_entries that skips updated_at 
-- when only automated fields (view_count, trending_score, etc.) are changed
CREATE OR REPLACE FUNCTION public.update_wiki_entries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
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

-- Drop the old generic trigger
DROP TRIGGER IF EXISTS update_wiki_entries_updated_at ON wiki_entries;

-- Create new trigger with the specialized function
CREATE TRIGGER update_wiki_entries_updated_at
  BEFORE UPDATE ON wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_wiki_entries_updated_at();
