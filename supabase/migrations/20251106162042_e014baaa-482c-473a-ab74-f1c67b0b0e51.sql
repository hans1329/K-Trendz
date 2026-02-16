-- Enable realtime for posts table
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable replica identity for posts table to get full row data
ALTER TABLE posts REPLICA IDENTITY FULL;