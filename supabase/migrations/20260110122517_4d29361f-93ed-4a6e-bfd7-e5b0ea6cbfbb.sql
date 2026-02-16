-- vesting_schedules 테이블에 onchain_schedule_id 컬럼 추가
ALTER TABLE public.vesting_schedules 
ADD COLUMN IF NOT EXISTS onchain_schedule_id integer;

-- revoke 관련 컬럼 추가
ALTER TABLE public.vesting_schedules 
ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS revoke_tx_hash text;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vesting_onchain_schedule_id ON public.vesting_schedules(onchain_schedule_id);