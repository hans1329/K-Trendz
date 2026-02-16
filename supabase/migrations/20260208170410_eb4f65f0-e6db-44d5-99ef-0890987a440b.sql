
-- KTrendz Test Bot API 키 교체
-- 새 키: ktbot_live_2026Q1_xK9mPvR3nW7jL5tQ
UPDATE public.bot_agents
SET 
  api_key = 'ktbot_live_2026Q1_xK9mPvR3nW7jL5tQ',
  api_key_hash = encode(sha256('ktbot_live_2026Q1_xK9mPvR3nW7jL5tQ'::bytea), 'hex'),
  updated_at = now()
WHERE id = '6ad08f2e-70b8-42a8-9b2f-ad47b370b22b';
