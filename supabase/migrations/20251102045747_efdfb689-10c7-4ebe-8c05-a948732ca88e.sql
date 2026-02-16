-- Update handle_new_user function to not expose email in display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  default_username TEXT;
BEGIN
  -- Generate username
  default_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    'user_' || substr(NEW.id::text, 1, 8)
  );
  
  -- Insert profile with username as display_name fallback (not email)
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    default_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', default_username)
  );
  
  RETURN NEW;
END;
$$;

-- Update existing profiles that have email as display_name
UPDATE public.profiles
SET display_name = username
WHERE display_name LIKE '%@%';