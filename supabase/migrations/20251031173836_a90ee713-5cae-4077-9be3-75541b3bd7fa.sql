-- Add unique constraint to community name
ALTER TABLE public.communities 
ADD CONSTRAINT communities_name_unique UNIQUE (name);

-- Add unique constraint to slug if not exists (for safety)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'communities_slug_unique'
  ) THEN
    ALTER TABLE public.communities 
    ADD CONSTRAINT communities_slug_unique UNIQUE (slug);
  END IF;
END $$;