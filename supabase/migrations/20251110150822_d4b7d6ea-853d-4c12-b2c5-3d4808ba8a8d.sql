-- Add foreign key constraint to wiki_entry_followers table
ALTER TABLE wiki_entry_followers
ADD CONSTRAINT wiki_entry_followers_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_wiki_entry_followers_user_id 
ON wiki_entry_followers(user_id);