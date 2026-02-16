-- Add event_date column to posts table
ALTER TABLE public.posts
ADD COLUMN event_date date;

-- Create index for event_date queries
CREATE INDEX idx_posts_event_date ON public.posts(event_date) WHERE event_date IS NOT NULL;

-- Create trigger function to sync post event dates to calendar_events
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
      WHERE reference_id = NEW.id 
      AND event_type = 'other'
    ) THEN
      -- Update existing calendar event
      UPDATE calendar_events
      SET 
        title = NEW.title,
        description = LEFT(NEW.content, 200),
        event_date = NEW.event_date,
        updated_at = now()
      WHERE reference_id = NEW.id
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
      
      -- Store the calendar event reference in post metadata
      UPDATE posts
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('calendar_synced', true)
      WHERE id = NEW.id;
    END IF;
  ELSIF OLD.event_date IS NOT NULL AND NEW.event_date IS NULL THEN
    -- If event_date was removed, delete the calendar event
    DELETE FROM calendar_events
    WHERE reference_id = NEW.id
      AND event_type = 'other';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync post events to calendar
DROP TRIGGER IF EXISTS sync_post_event_trigger ON public.posts;
CREATE TRIGGER sync_post_event_trigger
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_event_to_calendar();

-- Add metadata column to posts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add reference_id to calendar_events if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE public.calendar_events ADD COLUMN reference_id uuid;
    CREATE INDEX idx_calendar_events_reference_id ON public.calendar_events(reference_id);
  END IF;
END $$;