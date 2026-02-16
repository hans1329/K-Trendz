
-- 트리거 이름이 다를 수 있으므로 CASCADE로 함수와 의존 트리거 모두 제거
DROP FUNCTION IF EXISTS public.generate_bot_agent_address() CASCADE;
