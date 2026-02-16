-- Create table for storing encrypted wallet private keys
CREATE TABLE IF NOT EXISTS public.wallet_private_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(wallet_address)
);

-- Enable RLS
ALTER TABLE public.wallet_private_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view private keys (for emergency recovery)
CREATE POLICY "Admins can view private keys"
  ON public.wallet_private_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert keys
CREATE POLICY "Service role can insert keys"
  ON public.wallet_private_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_wallet_private_keys_user_id ON public.wallet_private_keys(user_id);
CREATE INDEX idx_wallet_private_keys_wallet_address ON public.wallet_private_keys(wallet_address);