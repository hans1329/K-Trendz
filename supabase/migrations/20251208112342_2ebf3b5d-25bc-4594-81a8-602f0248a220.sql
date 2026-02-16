-- Create wiki_categories table for managing entry categories
CREATE TABLE public.wiki_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view active categories
CREATE POLICY "Wiki categories are viewable by everyone"
ON public.wiki_categories
FOR SELECT
USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage wiki categories"
ON public.wiki_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default categories
INSERT INTO public.wiki_categories (value, label, display_order) VALUES
('news', 'News', 1),
('actor', 'Actor', 2),
('artist', 'Artist (Group)', 3),
('member', 'Member', 4),
('expert', 'Expert', 5),
('youtuber', 'YouTuber', 6),
('album', 'Album', 7),
('song', 'Song', 8),
('variety_show', 'Variety Show', 9),
('event', 'Event', 10),
('k_beauty', 'K-Beauty', 11),
('beauty_brand', 'Beauty Brand', 12),
('beauty_product', 'Beauty Product', 13),
('restaurant', 'Restaurant', 14),
('cafe', 'Cafe', 15),
('k_food', 'K-Food', 16),
('food_brand', 'Food Brand', 17),
('food_product', 'Food Product', 18),
('travel', 'Travel', 19);