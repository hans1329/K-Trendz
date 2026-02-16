-- Add parent_comment_id column to comments table for nested replies
ALTER TABLE comments
ADD COLUMN parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- Create index for better performance when querying nested comments
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);

-- Add comment to explain the self-referential relationship
COMMENT ON COLUMN comments.parent_comment_id IS 'References parent comment for nested replies. NULL for top-level comments.';