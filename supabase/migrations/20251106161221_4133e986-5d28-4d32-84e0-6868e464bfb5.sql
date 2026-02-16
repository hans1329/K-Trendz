-- Add verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_type text;

-- Add comment to explain verification_type
COMMENT ON COLUMN public.profiles.verification_type IS 'Type of verification: official, artist, staff, partner, etc.';

-- Create index for verified users
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON public.profiles(is_verified) WHERE is_verified = true;