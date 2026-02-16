-- 테스트용 봇 에이전트 생성
INSERT INTO bot_agents (name, api_key, api_key_hash, daily_limit_usd, is_active, wallet_address)
VALUES (
  'KTrendz Test Bot',
  'ktrendz-test-bot-key-2026',
  encode(sha256('ktrendz-test-bot-key-2026'::bytea), 'hex'),
  100,
  true,
  '0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36'
);