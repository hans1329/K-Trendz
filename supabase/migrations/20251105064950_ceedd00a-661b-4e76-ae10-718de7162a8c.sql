-- Migrate existing group-member relationships from metadata to wiki_entry_relationships table
INSERT INTO public.wiki_entry_relationships (parent_entry_id, child_entry_id, relationship_type, created_by)
SELECT 
  (we.metadata->>'group_id')::uuid as parent_entry_id,
  we.id as child_entry_id,
  'member_of' as relationship_type,
  we.creator_id as created_by
FROM public.wiki_entries we
WHERE we.schema_type = 'member' 
  AND we.metadata ? 'group_id'
  AND we.metadata->>'group_id' IS NOT NULL
  AND we.metadata->>'group_id' != ''
  -- Check if relationship doesn't already exist
  AND NOT EXISTS (
    SELECT 1 
    FROM public.wiki_entry_relationships wer
    WHERE wer.parent_entry_id = (we.metadata->>'group_id')::uuid
      AND wer.child_entry_id = we.id
      AND wer.relationship_type = 'member_of'
  )
ON CONFLICT (parent_entry_id, child_entry_id, relationship_type) DO NOTHING;