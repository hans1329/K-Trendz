-- Create pioneer_claims table for tracking Farcaster Frame claims
CREATE TABLE IF NOT EXISTS public.pioneer_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid BIGINT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pioneer_claims ENABLE ROW LEVEL SECURITY;

-- Admins can view all claims
CREATE POLICY "Admins can view all pioneer claims"
  ON public.pioneer_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can insert claims
CREATE POLICY "System can insert pioneer claims"
  ON public.pioneer_claims
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_pioneer_claims_fid ON public.pioneer_claims(fid);
CREATE INDEX idx_pioneer_claims_wallet ON public.pioneer_claims(wallet_address);

-- Insert Pioneer badge into gift_badges
INSERT INTO public.gift_badges (
  name,
  icon,
  description,
  usd_price,
  point_price,
  color,
  display_order,
  is_active
) VALUES (
  'Pioneer',
  '🎖️',
  'Early supporter of K-TRENDZ platform',
  0,
  NULL,
  '#FFD700',
  -1,
  true
) ON CONFLICT DO NOTHING;