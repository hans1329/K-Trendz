-- 긴급: 모든 잘못된 밴 해제 (오늘 봇 디텍터로 밴된 것들)
-- 어드민 계정 즉시 해제
DELETE FROM user_bans WHERE user_id = '2369c3e8-c2e7-43f6-800d-60dd2bd674c8';

-- 2026-02-10 12:56에 일괄 밴된 66건 전부 해제 (봇 디텍터 오작동)
DELETE FROM user_bans 
WHERE reason = 'Bot account detected by automated pattern matching'
  AND banned_at >= '2026-02-10 12:56:00'
  AND banned_at <= '2026-02-10 12:57:00';