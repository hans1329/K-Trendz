-- Populate wiki_entry_user_contributions with existing data
-- This will calculate contribution scores for all existing posts, comments, and votes

-- Step 1: Calculate scores from existing posts
INSERT INTO public.wiki_entry_user_contributions (
  wiki_entry_id,
  user_id,
  contribution_score,
  posts_count,
  comments_count,
  votes_received
)
SELECT 
  p.wiki_entry_id,
  p.user_id,
  COUNT(p.id)::integer * 10 as contribution_score, -- 10 points per post
  COUNT(p.id)::integer as posts_count,
  0 as comments_count,
  0 as votes_received
FROM public.posts p
WHERE p.wiki_entry_id IS NOT NULL
GROUP BY p.wiki_entry_id, p.user_id
ON CONFLICT (wiki_entry_id, user_id) 
DO UPDATE SET
  contribution_score = wiki_entry_user_contributions.contribution_score + EXCLUDED.contribution_score,
  posts_count = wiki_entry_user_contributions.posts_count + EXCLUDED.posts_count;

-- Step 2: Calculate scores from existing comments
INSERT INTO public.wiki_entry_user_contributions (
  wiki_entry_id,
  user_id,
  contribution_score,
  posts_count,
  comments_count,
  votes_received
)
SELECT 
  c.wiki_entry_id,
  c.user_id,
  COUNT(c.id)::integer * 5 as contribution_score, -- 5 points per comment
  0 as posts_count,
  COUNT(c.id)::integer as comments_count,
  0 as votes_received
FROM public.comments c
WHERE c.wiki_entry_id IS NOT NULL
GROUP BY c.wiki_entry_id, c.user_id
ON CONFLICT (wiki_entry_id, user_id) 
DO UPDATE SET
  contribution_score = wiki_entry_user_contributions.contribution_score + EXCLUDED.contribution_score,
  comments_count = wiki_entry_user_contributions.comments_count + EXCLUDED.comments_count;

-- Step 3: Calculate scores from existing upvotes (votes received by post authors)
INSERT INTO public.wiki_entry_user_contributions (
  wiki_entry_id,
  user_id,
  contribution_score,
  posts_count,
  comments_count,
  votes_received
)
SELECT 
  p.wiki_entry_id,
  p.user_id,
  COUNT(pv.id)::integer * 3 as contribution_score, -- 3 points per upvote received
  0 as posts_count,
  0 as comments_count,
  COUNT(pv.id)::integer as votes_received
FROM public.post_votes pv
JOIN public.posts p ON pv.post_id = p.id
WHERE pv.vote_type = 'up'
  AND p.wiki_entry_id IS NOT NULL
  AND pv.user_id != p.user_id  -- Don't count self-votes
GROUP BY p.wiki_entry_id, p.user_id
ON CONFLICT (wiki_entry_id, user_id) 
DO UPDATE SET
  contribution_score = wiki_entry_user_contributions.contribution_score + EXCLUDED.contribution_score,
  votes_received = wiki_entry_user_contributions.votes_received + EXCLUDED.votes_received;