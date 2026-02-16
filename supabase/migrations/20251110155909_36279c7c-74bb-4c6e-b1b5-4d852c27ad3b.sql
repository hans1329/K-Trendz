-- get_trending_wiki_entries 함수 재생성
DROP FUNCTION IF EXISTS get_trending_wiki_entries();

CREATE FUNCTION get_trending_wiki_entries()
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  content text,
  image_url text,
  schema_type text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_edited_by uuid,
  last_edited_at timestamptz,
  is_verified boolean,
  votes int,
  view_count int,
  likes_count int,
  follower_count int,
  metadata jsonb,
  is_boosted boolean,
  boosted_at timestamptz,
  boosted_until timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  pinned_by uuid,
  trending_score numeric,
  last_editor jsonb,
  creator jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    we.id,
    we.title,
    we.slug,
    we.content,
    we.image_url,
    we.schema_type::text,
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
    we.trending_score::numeric,
    CASE 
      WHEN we.last_edited_by IS NOT NULL AND p1.username IS NOT NULL THEN 
        jsonb_build_object(
          'username', p1.username,
          'avatar_url', p1.avatar_url
        )
      ELSE NULL
    END as last_editor,
    jsonb_build_object(
      'username', COALESCE(p2.username, 'Unknown'),
      'avatar_url', p2.avatar_url
    ) as creator
  FROM wiki_entries we
  LEFT JOIN profiles p1 ON we.last_edited_by = p1.id
  LEFT JOIN profiles p2 ON we.creator_id = p2.id
  ORDER BY 
    we.trending_score DESC,
    we.is_boosted DESC,
    we.votes DESC,
    we.view_count DESC
  LIMIT 8;
END;
$$;