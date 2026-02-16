-- Add stripe_account_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Add stripe_account_id to withdrawal_requests table and remove bank_info
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS bank_info;