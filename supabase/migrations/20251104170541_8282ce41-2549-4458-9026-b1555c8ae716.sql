-- Create function to get trending wiki entries based on badge score
CREATE OR REPLACE FUNCTION public.get_trending_wiki_entries()
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  image_url text,
  schema_type wiki_schema_type,
  creator_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_edited_by uuid,
  last_edited_at timestamp with time zone,
  is_verified boolean,
  votes integer,
  view_count integer,
  likes_count integer,
  follower_count integer,
  metadata jsonb,
  is_boosted boolean,
  boosted_at timestamp with time zone,
  boosted_until timestamp with time zone,
  is_pinned boolean,
  pinned_at timestamp with time zone,
  pinned_by uuid,
  last_editor jsonb,
  creator jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    we.id,
    we.title,
    we.content,
    we.image_url,
    we.schema_type,
    we.creator_id,
    we.created_at,
    we.updated_at,
    we.last_edited_by,
    we.last_edited_at,
    we.is_verified,
    we.votes,
    we.view_count,
    we.likes_count,
    we.follower_count,
    we.metadata,
    we.is_boosted,
    we.boosted_at,
    we.boosted_until,
    we.is_pinned,
    we.pinned_at,
    we.pinned_by,
    jsonb_build_object(
      'username', p1.username,
      'avatar_url', p1.avatar_url
    ) as last_editor,
    jsonb_build_object(
      'username', p2.username,
      'avatar_url', p2.avatar_url
    ) as creator
  FROM wiki_entries we
  LEFT JOIN profiles p1 ON we.last_edited_by = p1.id
  LEFT JOIN profiles p2 ON we.creator_id = p2.id
  ORDER BY 
    public.calculate_wiki_badge_score(we.id) DESC,
    we.is_boosted DESC,
    we.votes DESC,
    we.view_count DESC
  LIMIT 8;
END;
$function$;