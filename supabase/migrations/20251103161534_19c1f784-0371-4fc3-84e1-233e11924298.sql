-- Add voting and boost features to wiki_entries
ALTER TABLE public.wiki_entries
ADD COLUMN votes integer NOT NULL DEFAULT 0,
ADD COLUMN is_pinned boolean DEFAULT false,
ADD COLUMN is_boosted boolean DEFAULT false,
ADD COLUMN boosted_until timestamp with time zone,
ADD COLUMN boosted_at timestamp with time zone,
ADD COLUMN pinned_at timestamp with time zone,
ADD COLUMN pinned_by uuid REFERENCES auth.users(id);

-- Create wiki_entry_votes table
CREATE TABLE public.wiki_entry_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wiki_entry_id uuid NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, wiki_entry_id)
);

-- Enable RLS on wiki_entry_votes
ALTER TABLE public.wiki_entry_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for wiki_entry_votes
CREATE POLICY "Users can create their own votes"
ON public.wiki_entry_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own votes"
ON public.wiki_entry_votes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
ON public.wiki_entry_votes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
ON public.wiki_entry_votes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_wiki_entry_votes_wiki_entry_id ON public.wiki_entry_votes(wiki_entry_id);
CREATE INDEX idx_wiki_entry_votes_user_id ON public.wiki_entry_votes(user_id);

-- Function to calculate wiki entry votes
CREATE OR REPLACE FUNCTION calculate_wiki_entry_votes(wiki_entry_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE -1 END)::INTEGER,
    0
  )
  FROM public.wiki_entry_votes
  WHERE wiki_entry_id = wiki_entry_id_param
$$;

-- Trigger to update wiki entry votes count
CREATE OR REPLACE FUNCTION update_wiki_entry_votes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.wiki_entries
    SET votes = calculate_wiki_entry_votes(NEW.wiki_entry_id)
    WHERE id = NEW.wiki_entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wiki_entries
    SET votes = calculate_wiki_entry_votes(OLD.wiki_entry_id)
    WHERE id = OLD.wiki_entry_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_wiki_entry_votes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.wiki_entry_votes
FOR EACH ROW
EXECUTE FUNCTION update_wiki_entry_votes_count();

-- Functions for boosting wiki entries
CREATE OR REPLACE FUNCTION boost_wiki_entry(wiki_entry_id_param uuid, duration_hours integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_creator_id uuid;
  hourly_cost integer;
  total_cost integer;
  current_available_points integer;
BEGIN
  IF duration_hours < 1 OR duration_hours > 72 THEN
    RAISE EXCEPTION 'Invalid duration. Must be between 1 and 72 hours';
  END IF;
  
  SELECT creator_id INTO entry_creator_id
  FROM public.wiki_entries
  WHERE id = wiki_entry_id_param;
  
  IF entry_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only boost your own wiki entries';
  END IF;
  
  SELECT points INTO hourly_cost
  FROM public.point_rules
  WHERE action_type = 'boost_post_per_hour' AND is_active = true;
  
  IF hourly_cost IS NULL THEN
    hourly_cost := -5;
  END IF;
  
  total_cost := hourly_cost * duration_hours;
  
  SELECT available_points INTO current_available_points
  FROM public.profiles
  WHERE id = entry_creator_id;
  
  IF current_available_points + total_cost < 0 THEN
    RAISE EXCEPTION 'Insufficient points to boost wiki entry';
  END IF;
  
  UPDATE public.profiles
  SET available_points = available_points + total_cost
  WHERE id = entry_creator_id;
  
  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (entry_creator_id, 'boost_post_per_hour', total_cost, wiki_entry_id_param);
  
  UPDATE public.wiki_entries
  SET 
    is_boosted = true,
    boosted_at = now(),
    boosted_until = now() + (duration_hours || ' hours')::interval
  WHERE id = wiki_entry_id_param;
  
  RETURN true;
END;
$$;

-- Functions for pinning wiki entries
CREATE OR REPLACE FUNCTION pin_wiki_entry(wiki_entry_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_user_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_user_admin;
  
  IF NOT is_user_admin THEN
    RAISE EXCEPTION 'Only admins can pin wiki entries';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.wiki_entries WHERE id = wiki_entry_id_param AND is_pinned = true) THEN
    RAISE EXCEPTION 'Wiki entry is already pinned';
  END IF;
  
  UPDATE public.wiki_entries
  SET 
    is_pinned = true,
    pinned_at = now(),
    pinned_by = auth.uid()
  WHERE id = wiki_entry_id_param;
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION unpin_wiki_entry(wiki_entry_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_user_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_user_admin;
  
  IF NOT is_user_admin THEN
    RAISE EXCEPTION 'Only admins can unpin wiki entries';
  END IF;
  
  UPDATE public.wiki_entries
  SET 
    is_pinned = false,
    pinned_at = null,
    pinned_by = null
  WHERE id = wiki_entry_id_param;
  
  RETURN true;
END;
$$;