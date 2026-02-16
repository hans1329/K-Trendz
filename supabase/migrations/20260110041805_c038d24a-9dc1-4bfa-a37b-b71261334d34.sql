-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view active challenges" ON challenges;

-- Create new SELECT policy that allows viewing active and ended challenges
CREATE POLICY "Anyone can view challenges" ON challenges
  FOR SELECT
  USING (
    status IN ('active', 'ended', 'approved', 'cancelled') 
    OR has_role(auth.uid(), 'admin'::app_role)
  );