-- Step 1: app_role enum에 엔트리 역할 추가
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'entry_agent';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'entry_moderator';