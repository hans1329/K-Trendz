-- user_agents에 avatar_url 컬럼 추가
ALTER TABLE public.user_agents ADD COLUMN IF NOT EXISTS avatar_url text;