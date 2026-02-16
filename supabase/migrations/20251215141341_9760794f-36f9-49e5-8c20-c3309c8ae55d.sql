-- Update fanz_tokens base_price to match on-chain value ($1.65 USD)
UPDATE fanz_tokens 
SET base_price = 1.65 
WHERE base_price = 0.95;