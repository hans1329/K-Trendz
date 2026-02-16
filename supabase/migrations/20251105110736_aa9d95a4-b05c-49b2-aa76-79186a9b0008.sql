-- Add slug column to wiki_entries table
ALTER TABLE wiki_entries ADD COLUMN slug text;

-- Create a temporary function to generate unique slugs
CREATE OR REPLACE FUNCTION generate_unique_slug(base_title text, entry_id uuid) 
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Create base slug from title
  base_slug := lower(regexp_replace(trim(base_title), '[^a-zA-Z0-9가-힣\s-]', '', 'g'));
  base_slug := regexp_replace(regexp_replace(base_slug, '\s+', '-', 'g'), '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- If empty, use 'entry'
  IF base_slug = '' THEN
    base_slug := 'entry';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append counter if needed
  WHILE EXISTS (SELECT 1 FROM wiki_entries WHERE slug = final_slug AND id != entry_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Generate unique slugs for existing entries
UPDATE wiki_entries
SET slug = generate_unique_slug(title, id);

-- Drop the temporary function
DROP FUNCTION generate_unique_slug(text, uuid);

-- Create unique index on slug
CREATE UNIQUE INDEX wiki_entries_slug_idx ON wiki_entries(slug);

-- Make slug NOT NULL
ALTER TABLE wiki_entries ALTER COLUMN slug SET NOT NULL;