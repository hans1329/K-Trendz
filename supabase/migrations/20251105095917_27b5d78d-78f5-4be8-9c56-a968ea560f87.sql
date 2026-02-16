-- Add view_count and trending_score columns to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trending_score integer NOT NULL DEFAULT 0;

-- Create index for better performance on trending queries
CREATE INDEX IF NOT EXISTS idx_posts_trending_score ON posts(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_view_count ON posts(view_count DESC);