-- Make category nullable for community posts
ALTER TABLE posts 
ALTER COLUMN category DROP NOT NULL;