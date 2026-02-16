-- Update wiki_entries delete policy to allow admins
DROP POLICY IF EXISTS "Creators can delete their wiki entries" ON wiki_entries;

CREATE POLICY "Creators and admins can delete wiki entries" 
ON wiki_entries 
FOR DELETE 
USING (
  auth.uid() = creator_id OR has_role(auth.uid(), 'admin'::app_role)
);