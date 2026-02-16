-- Create enum for wiki schema types
CREATE TYPE public.wiki_schema_type AS ENUM (
  'artist',
  'album', 
  'song',
  'variety_show',
  'event',
  'member'
);

-- Create enum for event types
CREATE TYPE public.event_type AS ENUM (
  'birthday',
  'comeback',
  'concert',
  'fanmeeting',
  'variety_appearance',
  'award_show',
  'other'
);

-- Wiki entries table
CREATE TABLE public.wiki_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_type wiki_schema_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Store schema-specific fields
  image_url TEXT,
  creator_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type NOT NULL,
  event_date DATE NOT NULL,
  wiki_entry_id UUID REFERENCES public.wiki_entries(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Quests table
CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL, -- e.g., 'birthday_comment', 'comeback_post', etc.
  points_reward INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb, -- Quest conditions (e.g., event_id, required_action)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quest completions table
CREATE TABLE public.quest_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE(quest_id, user_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wiki_entries
CREATE POLICY "Wiki entries are viewable by everyone"
ON public.wiki_entries FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create wiki entries"
ON public.wiki_entries FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their wiki entries"
ON public.wiki_entries FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their wiki entries"
ON public.wiki_entries FOR DELETE
USING (auth.uid() = creator_id);

CREATE POLICY "Admins can verify wiki entries"
ON public.wiki_entries FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for calendar_events
CREATE POLICY "Calendar events are viewable by everyone"
ON public.calendar_events FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their calendar events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their calendar events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = creator_id);

-- RLS Policies for quests
CREATE POLICY "Active quests are viewable by everyone"
ON public.quests FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage quests"
ON public.quests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for quest_completions
CREATE POLICY "Users can view their own quest completions"
ON public.quest_completions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quest completions"
ON public.quest_completions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE TRIGGER update_wiki_entries_updated_at
BEFORE UPDATE ON public.wiki_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quests_updated_at
BEFORE UPDATE ON public.quests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check and complete quest
CREATE OR REPLACE FUNCTION public.check_and_complete_quest(
  user_id_param UUID,
  quest_type_param TEXT,
  reference_data JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quest_record RECORD;
  already_completed BOOLEAN;
  points_to_award INTEGER;
BEGIN
  -- Find active quest matching type and date range
  SELECT * INTO quest_record
  FROM public.quests
  WHERE quest_type = quest_type_param
    AND is_active = true
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  LIMIT 1;
  
  IF quest_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if already completed
  SELECT EXISTS (
    SELECT 1 FROM public.quest_completions
    WHERE quest_id = quest_record.id AND user_id = user_id_param
  ) INTO already_completed;
  
  IF already_completed THEN
    RETURN false;
  END IF;
  
  -- Mark quest as completed
  INSERT INTO public.quest_completions (quest_id, user_id, points_awarded)
  VALUES (quest_record.id, user_id_param, quest_record.points_reward);
  
  -- Award points
  PERFORM public.award_points(user_id_param, 'quest_completion', quest_record.id);
  
  RETURN true;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_wiki_entries_schema_type ON public.wiki_entries(schema_type);
CREATE INDEX idx_wiki_entries_creator ON public.wiki_entries(creator_id);
CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(event_type);
CREATE INDEX idx_calendar_events_wiki_entry ON public.calendar_events(wiki_entry_id);
CREATE INDEX idx_quests_active ON public.quests(is_active, quest_type);
CREATE INDEX idx_quest_completions_user ON public.quest_completions(user_id);