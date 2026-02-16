-- Update all fanz_tokens to use V3 contract address
UPDATE fanz_tokens 
SET contract_address = '0x0f02469C9EBf296E33A70F335Ab5Df8BC876c33c', 
    updated_at = now() 
WHERE contract_address = '0xa899cD21ba25f9F7d8C49D13E4724f1ABb43ed02' 
   OR contract_address IS NULL;