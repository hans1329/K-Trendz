-- bot_agents 등록 시 자동으로 고유 식별 주소를 생성하는 함수
-- 실제 자금 보유 불필요, 온체인 이벤트 로그에서 에이전트 구분용
CREATE OR REPLACE FUNCTION public.generate_bot_agent_address()
RETURNS TRIGGER AS $$
BEGIN
  -- wallet_address가 없거나 Admin Wallet과 같으면 랜덤 주소 생성
  IF NEW.wallet_address IS NULL OR NEW.wallet_address = '0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36' THEN
    NEW.wallet_address := '0x' || encode(gen_random_bytes(20), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- INSERT 시 자동 주소 생성 트리거
CREATE TRIGGER trg_bot_agent_address
BEFORE INSERT ON public.bot_agents
FOR EACH ROW
EXECUTE FUNCTION public.generate_bot_agent_address();
