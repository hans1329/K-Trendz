-- Add stripe_payment_intent_id to fanz_transactions for accurate refund matching
ALTER TABLE fanz_transactions 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fanz_transactions_payment_intent 
ON fanz_transactions(stripe_payment_intent_id);

-- Add comment
COMMENT ON COLUMN fanz_transactions.stripe_payment_intent_id IS 'Stripe Payment Intent ID for matching refunds and chargebacks';