-- Drop the problematic policy
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Create simpler policies without recursion
-- Only allow viewing own roles (this already exists but let's ensure it's correct)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- For admin operations, we'll handle permissions at the application level
-- or use service role key for admin operations