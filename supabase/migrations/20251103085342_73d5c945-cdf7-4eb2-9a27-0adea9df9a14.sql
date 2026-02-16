-- Create table for point purchase products
CREATE TABLE public.point_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  product_type TEXT NOT NULL DEFAULT 'one_time', -- 'one_time' or 'subscription'
  billing_interval TEXT, -- 'month', 'year' for subscriptions
  display_order INTEGER NOT NULL DEFAULT 0,
  badge_text TEXT, -- e.g., 'Best Value', 'Popular'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_products ENABLE ROW LEVEL SECURITY;

-- Everyone can view active products
CREATE POLICY "Active products are viewable by everyone"
  ON public.point_products
  FOR SELECT
  USING (is_active = true);

-- Admins can manage products
CREATE POLICY "Admins can manage products"
  ON public.point_products
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create table for purchase history
CREATE TABLE public.point_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.point_products(id) ON DELETE SET NULL,
  points_received INTEGER NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
  ON public.point_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert purchases
CREATE POLICY "System can insert purchases"
  ON public.point_purchases
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
  ON public.point_purchases
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_point_products_updated_at
  BEFORE UPDATE ON public.point_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default products
INSERT INTO public.point_products (name, description, points, price_usd, product_type, display_order, badge_text) VALUES
  ('Starter Pack', '100 points for basic activities', 100, 0.99, 'one_time', 1, NULL),
  ('Popular Pack', '500 points - Best value!', 500, 3.99, 'one_time', 2, 'Best Value'),
  ('Pro Pack', '1,200 points with bonus', 1200, 7.99, 'one_time', 3, '+20% Bonus'),
  ('Premium Pack', '3,000 points mega pack', 3000, 14.99, 'one_time', 4, 'Popular'),
  ('Monthly Subscription', 'Get 500 points every month', 500, 4.99, 'subscription', 5, 'Recurring'),
  ('Yearly Subscription', 'Get 6,500 points per year (save 15%)', 6500, 49.99, 'subscription', 6, 'Save 15%')
ON CONFLICT DO NOTHING;