-- Update all existing posts to calculate their trending scores
UPDATE posts
SET trending_score = (
  (COALESCE(votes, 0) * 10) +
  (COALESCE(view_count, 0)) +
  ((SELECT COUNT(*)::integer FROM comments WHERE post_id = posts.id) * 5)
)
WHERE trending_score = 0 OR trending_score IS NULL;