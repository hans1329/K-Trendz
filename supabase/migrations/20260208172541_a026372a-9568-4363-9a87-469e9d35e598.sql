-- gen_random_bytes가 extensions 스키마에 있으므로 search_path 수정
CREATE OR REPLACE FUNCTION public.generate_bot_agent_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.wallet_address IS NULL OR NEW.wallet_address = '0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36' THEN
    NEW.wallet_address := '0x' || encode(extensions.gen_random_bytes(20), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;