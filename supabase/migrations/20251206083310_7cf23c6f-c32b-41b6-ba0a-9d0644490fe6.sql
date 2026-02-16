-- Add admin update policy for levels table
CREATE POLICY "Admins can update levels"
ON public.levels
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);