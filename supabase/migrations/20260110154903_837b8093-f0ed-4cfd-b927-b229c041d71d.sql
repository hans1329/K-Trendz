-- 모든 active 스케줄을 cancelled로 업데이트
UPDATE public.vesting_schedules 
SET status = 'cancelled', revoked_at = now() 
WHERE status = 'active' AND onchain_schedule_id IS NOT NULL;