-- Change gift badge pricing from points to USD
ALTER TABLE public.gift_badges 
  DROP COLUMN IF EXISTS point_cost,
  ADD COLUMN IF NOT EXISTS usd_price numeric NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Update purchase function to add badges to inventory (called after Stripe payment)
CREATE OR REPLACE FUNCTION public.add_badge_to_inventory(
  user_id_param uuid,
  badge_id_param uuid,
  quantity_param integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add to inventory
  INSERT INTO public.user_gift_badge_inventory (user_id, gift_badge_id, quantity)
  VALUES (user_id_param, badge_id_param, quantity_param)
  ON CONFLICT (user_id, gift_badge_id)
  DO UPDATE SET 
    quantity = user_gift_badge_inventory.quantity + quantity_param,
    updated_at = now();
  
  RETURN true;
END;
$$;

-- Drop old purchase function
DROP FUNCTION IF EXISTS public.purchase_gift_badge(uuid, integer);