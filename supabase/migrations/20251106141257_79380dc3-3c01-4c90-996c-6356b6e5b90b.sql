-- Fix infinite recursion in sync_post_event_to_calendar trigger
CREATE OR REPLACE FUNCTION public.sync_post_event_to_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If event_date is set, create or update calendar event
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
$$;