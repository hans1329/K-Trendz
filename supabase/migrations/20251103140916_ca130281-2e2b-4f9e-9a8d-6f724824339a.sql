-- Create gift badge system tables

-- Gift badge types (purchasable badges to give to artists)
CREATE TABLE IF NOT EXISTS public.gift_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  description text,
  point_cost integer NOT NULL DEFAULT 10,
  color text DEFAULT '#FF4500',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User's inventory of gift badges
CREATE TABLE IF NOT EXISTS public.user_gift_badge_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gift_badge_id uuid NOT NULL REFERENCES gift_badges(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, gift_badge_id)
);

-- Gift badges given to wiki entries (artists, groups, etc.)
CREATE TABLE IF NOT EXISTS public.wiki_entry_gift_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_entry_id uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  gift_badge_id uuid NOT NULL REFERENCES gift_badges(id) ON DELETE CASCADE,
  giver_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gift_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gift_badge_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_entry_gift_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gift_badges
CREATE POLICY "Gift badges are viewable by everyone"
  ON public.gift_badges FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage gift badges"
  ON public.gift_badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user_gift_badge_inventory
CREATE POLICY "Users can view their own inventory"
  ON public.user_gift_badge_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
  ON public.user_gift_badge_inventory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert inventory"
  ON public.user_gift_badge_inventory FOR INSERT
  WITH CHECK (true);

-- RLS Policies for wiki_entry_gift_badges
CREATE POLICY "Gift badges on entries are viewable by everyone"
  ON public.wiki_entry_gift_badges FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can give badges"
  ON public.wiki_entry_gift_badges FOR INSERT
  WITH CHECK (auth.uid() = giver_user_id);

-- Insert default gift badges
INSERT INTO public.gift_badges (name, icon, description, point_cost, color, display_order) VALUES
  ('Heart', '❤️', 'Show your love', 10, '#FF4500', 1),
  ('Star', '⭐', 'They shine bright', 15, '#FFD700', 2),
  ('Fire', '🔥', 'They''re on fire!', 20, '#FF6347', 3),
  ('Crown', '👑', 'True royalty', 50, '#FFD700', 4),
  ('Diamond', '💎', 'Precious talent', 100, '#00CED1', 5);

-- Function to purchase gift badges
CREATE OR REPLACE FUNCTION public.purchase_gift_badge(
  badge_id_param uuid,
  quantity_param integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_cost integer;
  total_cost integer;
  user_points integer;
BEGIN
  -- Get badge cost
  SELECT point_cost INTO badge_cost
  FROM public.gift_badges
  WHERE id = badge_id_param AND is_active = true;
  
  IF badge_cost IS NULL THEN
    RAISE EXCEPTION 'Badge not found or not active';
  END IF;
  
  -- Calculate total cost
  total_cost := badge_cost * quantity_param;
  
  -- Get user's available points
  SELECT available_points INTO user_points
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Check if user has enough points
  IF user_points < total_cost THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;
  
  -- Deduct points
  UPDATE public.profiles
  SET available_points = available_points - total_cost
  WHERE id = auth.uid();
  
  -- Add to inventory
  INSERT INTO public.user_gift_badge_inventory (user_id, gift_badge_id, quantity)
  VALUES (auth.uid(), badge_id_param, quantity_param)
  ON CONFLICT (user_id, gift_badge_id)
  DO UPDATE SET 
    quantity = user_gift_badge_inventory.quantity + quantity_param,
    updated_at = now();
  
  -- Record transaction
  INSERT INTO public.point_transactions (user_id, action_type, points, reference_id)
  VALUES (auth.uid(), 'purchase_gift_badge', -total_cost, badge_id_param);
  
  RETURN true;
END;
$$;

-- Function to give badge to wiki entry
CREATE OR REPLACE FUNCTION public.give_badge_to_entry(
  entry_id_param uuid,
  badge_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_badge_count integer;
BEGIN
  -- Check if user has this badge in inventory
  SELECT quantity INTO user_badge_count
  FROM public.user_gift_badge_inventory
  WHERE user_id = auth.uid() AND gift_badge_id = badge_id_param;
  
  IF user_badge_count IS NULL OR user_badge_count < 1 THEN
    RAISE EXCEPTION 'Badge not in inventory';
  END IF;
  
  -- Deduct from inventory
  UPDATE public.user_gift_badge_inventory
  SET 
    quantity = quantity - 1,
    updated_at = now()
  WHERE user_id = auth.uid() AND gift_badge_id = badge_id_param;
  
  -- Give badge to entry
  INSERT INTO public.wiki_entry_gift_badges (wiki_entry_id, gift_badge_id, giver_user_id)
  VALUES (entry_id_param, badge_id_param, auth.uid());
  
  RETURN true;
END;
$$;