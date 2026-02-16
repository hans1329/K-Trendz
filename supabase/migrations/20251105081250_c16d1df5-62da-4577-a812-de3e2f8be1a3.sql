-- Add trending_score column to wiki_entries
ALTER TABLE public.wiki_entries 
ADD COLUMN IF NOT EXISTS trending_score INTEGER NOT NULL DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_wiki_entries_trending_score ON public.wiki_entries(trending_score DESC);

-- Create function to calculate trending score
-- Score = (votes * 10) + (view_count * 1) + (likes_count * 5) + (follower_count * 3) + (badge_score * 20)
CREATE OR REPLACE FUNCTION public.update_wiki_trending_score()
RETURNS TRIGGER AS $$
DECLARE
  badge_score INTEGER;
BEGIN
  -- Calculate badge score
  badge_score := public.calculate_wiki_badge_score(NEW.id);
  
  -- Calculate trending score with weights
  NEW.trending_score := 
    (COALESCE(NEW.votes, 0) * 10) +           -- 투표: 가중치 10
    (COALESCE(NEW.view_count, 0) * 1) +       -- 조회수: 가중치 1
    (COALESCE(NEW.likes_count, 0) * 5) +      -- 좋아요: 가중치 5
    (COALESCE(NEW.follower_count, 0) * 3) +   -- 팔로워: 가중치 3
    (badge_score * 20);                        -- 뱃지: 가중치 20
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update trending score
DROP TRIGGER IF EXISTS wiki_entry_trending_score_trigger ON public.wiki_entries;
CREATE TRIGGER wiki_entry_trending_score_trigger
  BEFORE INSERT OR UPDATE OF votes, view_count, likes_count, follower_count
  ON public.wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wiki_trending_score();

-- Update existing entries with initial scores
UPDATE public.wiki_entries
SET trending_score = 
  (COALESCE(votes, 0) * 10) +
  (COALESCE(view_count, 0) * 1) +
  (COALESCE(likes_count, 0) * 5) +
  (COALESCE(follower_count, 0) * 3) +
  (public.calculate_wiki_badge_score(id) * 20);

-- Create trigger to update score when badges are given
CREATE OR REPLACE FUNCTION public.update_wiki_score_on_badge()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate score for the wiki entry
  UPDATE public.wiki_entries
  SET trending_score = 
    (COALESCE(votes, 0) * 10) +
    (COALESCE(view_count, 0) * 1) +
    (COALESCE(likes_count, 0) * 5) +
    (COALESCE(follower_count, 0) * 3) +
    (public.calculate_wiki_badge_score(COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id)) * 20)
  WHERE id = COALESCE(NEW.wiki_entry_id, OLD.wiki_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS wiki_badge_score_update_trigger ON public.wiki_entry_gift_badges;
CREATE TRIGGER wiki_badge_score_update_trigger
  AFTER INSERT OR DELETE ON public.wiki_entry_gift_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wiki_score_on_badge();