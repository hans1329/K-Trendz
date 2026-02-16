-- Create wallet_addresses table for Base network
CREATE TABLE IF NOT EXISTS public.wallet_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wallet_address text NOT NULL UNIQUE,
  network text DEFAULT 'base' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.wallet_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own wallet
CREATE POLICY "Users can view own wallet"
ON public.wallet_addresses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets"
ON public.wallet_addresses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert wallets (via service role)
CREATE POLICY "Service role can insert wallets"
ON public.wallet_addresses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_wallet_addresses_user_id ON public.wallet_addresses(user_id);
CREATE INDEX idx_wallet_addresses_wallet_address ON public.wallet_addresses(wallet_address);