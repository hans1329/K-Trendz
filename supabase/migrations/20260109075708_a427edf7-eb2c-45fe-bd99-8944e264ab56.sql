-- Add onchain_challenge_id column to challenges table
ALTER TABLE public.challenges 
ADD COLUMN onchain_challenge_id INTEGER NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.challenges.onchain_challenge_id IS 'The challenge ID on the blockchain smart contract';