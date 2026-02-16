-- Add is_verified column to communities table
ALTER TABLE public.communities
ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;

-- Create policy for admins to update verification status
CREATE POLICY "Admins can update community verification"
ON public.communities
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));