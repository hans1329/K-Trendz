-- Add foreign key relationships for wiki_edit_history and wiki_gallery tables

-- Add foreign key for wiki_edit_history.editor_id -> profiles.id
ALTER TABLE wiki_edit_history
ADD CONSTRAINT wiki_edit_history_editor_id_fkey
FOREIGN KEY (editor_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key for wiki_gallery.user_id -> profiles.id  
ALTER TABLE wiki_gallery
ADD CONSTRAINT wiki_gallery_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;