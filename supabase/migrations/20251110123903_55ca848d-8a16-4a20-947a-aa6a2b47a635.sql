-- Add og_image_url column to wiki_entries table
ALTER TABLE wiki_entries 
ADD COLUMN IF NOT EXISTS og_image_url TEXT;