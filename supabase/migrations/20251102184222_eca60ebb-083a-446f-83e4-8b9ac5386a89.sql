-- Add point rules for wiki entry actions
INSERT INTO public.point_rules (action_type, category, description, points, is_active)
VALUES 
  ('create_wiki_entry', 'wiki', 'Cost to create a new wiki entry', -10, true),
  ('edit_wiki_entry', 'wiki', 'Cost to edit an existing wiki entry', -5, true)
ON CONFLICT (action_type) DO NOTHING;

-- Create function to deduct points on wiki entry creation
CREATE OR REPLACE FUNCTION public.deduct_points_on_wiki_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_deducted boolean;
BEGIN
  -- Try to deduct points for creating wiki entry
  points_deducted := public.deduct_points(NEW.creator_id, 'create_wiki_entry', NEW.id);
  
  -- If points couldn't be deducted, prevent wiki entry creation
  IF NOT points_deducted THEN
    RAISE EXCEPTION 'Insufficient points to create wiki entry';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to deduct points on wiki entry edit
CREATE OR REPLACE FUNCTION public.deduct_points_on_wiki_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_deducted boolean;
  editor_id uuid;
BEGIN
  -- Only deduct points if content or title changed
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    editor_id := auth.uid();
    
    -- Try to deduct points for editing wiki entry
    points_deducted := public.deduct_points(editor_id, 'edit_wiki_entry', NEW.id);
    
    -- If points couldn't be deducted, prevent wiki entry edit
    IF NOT points_deducted THEN
      RAISE EXCEPTION 'Insufficient points to edit wiki entry';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for wiki entry actions
DROP TRIGGER IF EXISTS deduct_points_on_wiki_create_trigger ON wiki_entries;
CREATE TRIGGER deduct_points_on_wiki_create_trigger
  BEFORE INSERT ON wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_points_on_wiki_create();

DROP TRIGGER IF EXISTS deduct_points_on_wiki_edit_trigger ON wiki_entries;
CREATE TRIGGER deduct_points_on_wiki_edit_trigger
  BEFORE UPDATE ON wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_points_on_wiki_edit();