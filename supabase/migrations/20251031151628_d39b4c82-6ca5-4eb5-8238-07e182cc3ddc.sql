-- Add source_url column to posts table
ALTER TABLE public.posts 
ADD COLUMN source_url text;