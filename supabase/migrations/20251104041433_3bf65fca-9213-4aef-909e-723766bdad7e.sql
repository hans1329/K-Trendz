-- Create comment_votes table to track user votes on comments
CREATE TABLE IF NOT EXISTS comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, comment_id)
);

-- Enable RLS
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own comment votes"
  ON comment_votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own comment votes"
  ON comment_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment votes"
  ON comment_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment votes"
  ON comment_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_comment_votes_user_id ON comment_votes(user_id);
CREATE INDEX idx_comment_votes_comment_id ON comment_votes(comment_id);