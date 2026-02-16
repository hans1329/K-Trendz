-- 기존 테스트 봇의 wallet_address를 고유 식별 주소로 업데이트
-- Admin Wallet과 동일했던 주소를 랜덤 식별 주소로 변경
UPDATE public.bot_agents 
SET wallet_address = '0x' || encode(gen_random_bytes(20), 'hex')
WHERE id = '6ad08f2e-70b8-42a8-9b2f-ad47b370b22b'
  AND wallet_address = '0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36';

-- search_path 보안 경고 수정
CREATE OR REPLACE FUNCTION public.generate_bot_agent_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wallet_address IS NULL OR NEW.wallet_address = '0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36' THEN
    NEW.wallet_address := '0x' || encode(gen_random_bytes(20), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
