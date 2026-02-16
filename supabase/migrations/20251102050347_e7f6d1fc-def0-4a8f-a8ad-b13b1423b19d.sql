-- Drop the public view policy for post_votes
DROP POLICY IF EXISTS "Anyone can view post votes" ON public.post_votes;

-- Create new policy: users can only view their own votes
CREATE POLICY "Users can view their own votes"
ON public.post_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);