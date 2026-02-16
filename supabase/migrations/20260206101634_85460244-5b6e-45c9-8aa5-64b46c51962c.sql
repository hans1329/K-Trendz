
-- Bot Contract에 등록된 토큰을 추적하기 위한 컬럼 추가
ALTER TABLE public.fanz_tokens 
ADD COLUMN IF NOT EXISTS bot_contract_registered BOOLEAN DEFAULT false;

-- 기존 6개 파일럿 토큰을 Bot Contract 등록 상태로 업데이트
-- K-Trendz Supporters, RIIZE, Ive, Cortis, BTS, All Day Project
UPDATE public.fanz_tokens 
SET bot_contract_registered = true
WHERE token_id IN (
  '12666454296509763493',  -- K-Trendz Supporters
  '7963681970480434413',   -- RIIZE
  '4607865675402095874',   -- Ive
  '13766662462343366758',  -- Cortis
  '9138265216282739420',   -- BTS
  '18115915419890895215'   -- All Day Project
);

COMMENT ON COLUMN public.fanz_tokens.bot_contract_registered IS 'FanzTokenBot 컨트랙트에 등록된 토큰 여부';
