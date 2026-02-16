-- Add structured fields to wiki_entries for basic information
-- All columns are nullable to maintain compatibility with existing data

ALTER TABLE public.wiki_entries 
ADD COLUMN IF NOT EXISTS real_name TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS blood_type TEXT,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS weight INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.wiki_entries.real_name IS 'Real name (본명) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.birth_date IS 'Birth date (생년월일) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.gender IS 'Gender (성별) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.nationality IS 'Nationality (국적) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.blood_type IS 'Blood type (혈액형) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.height IS 'Height in cm (신장) - used for member/actor entries';
COMMENT ON COLUMN public.wiki_entries.weight IS 'Weight in kg (체중) - used for member/actor entries';

-- Create indexes for frequently searched fields
CREATE INDEX IF NOT EXISTS idx_wiki_entries_birth_date ON public.wiki_entries(birth_date) WHERE birth_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wiki_entries_gender ON public.wiki_entries(gender) WHERE gender IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wiki_entries_nationality ON public.wiki_entries(nationality) WHERE nationality IS NOT NULL;