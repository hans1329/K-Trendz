-- Drop existing trigger
DROP TRIGGER IF EXISTS sync_post_event_to_calendar_trigger ON posts;

-- Update the function to handle DELETE operations
CREATE OR REPLACE FUNCTION public.sync_post_event_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle DELETE operation
  IF TG_OP = 'DELETE' THEN
    -- Delete calendar event when post is deleted
    DELETE FROM calendar_events
    WHERE metadata->>'post_id' = OLD.id::text
      AND event_type = 'other';
    RETURN OLD;
  END IF;
  
  -- Handle INSERT and UPDATE operations
  IF NEW.event_date IS NOT NULL THEN
    -- Check if calendar event already exists for this post
    IF EXISTS (
      SELECT 1 FROM calendar_events 
      WHERE metadata->>'post_id' = NEW.id::text
      AND event_type = 'other'
    ) THEN
      -- Update existing calendar event
      UPDATE calendar_events
      SET 
        title = NEW.title,
        description = LEFT(NEW.content, 200),
        event_date = NEW.event_date,
        updated_at = now()
      WHERE metadata->>'post_id' = NEW.id::text
        AND event_type = 'other';
    ELSE
      -- Create new calendar event
      INSERT INTO calendar_events (
        title,
        description,
        event_date,
        event_type,
        creator_id,
        wiki_entry_id,
        is_recurring,
        metadata
      ) VALUES (
        NEW.title,
        LEFT(NEW.content, 200),
        NEW.event_date,
        'other',
        NEW.user_id,
        NEW.wiki_entry_id,
        false,
        jsonb_build_object('post_id', NEW.id)
      );
    END IF;
  ELSIF OLD.event_date IS NOT NULL AND NEW.event_date IS NULL THEN
    -- If event_date was removed, delete the calendar event
    DELETE FROM calendar_events
    WHERE metadata->>'post_id' = NEW.id::text
      AND event_type = 'other';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger to fire on DELETE as well
CREATE TRIGGER sync_post_event_to_calendar_trigger
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW
EXECUTE FUNCTION sync_post_event_to_calendar();