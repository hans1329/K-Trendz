-- Drop the existing policy that only allows authenticated users
DROP POLICY IF EXISTS "System settings are viewable by everyone" ON public.system_settings;

-- Create a new policy that allows both authenticated and anonymous users to view settings
CREATE POLICY "System settings are viewable by everyone" 
ON public.system_settings 
FOR SELECT 
TO authenticated, anon
USING (true);