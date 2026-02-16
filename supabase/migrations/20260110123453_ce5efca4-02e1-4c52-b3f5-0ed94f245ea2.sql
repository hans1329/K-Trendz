-- Update onchain_schedule_id for active vesting schedules
UPDATE public.vesting_schedules SET onchain_schedule_id = 0 WHERE tx_hash = '0x7cc46a13b2ecd3c701a56ad30066cd86b980001c7802b9dd58bfba129d8493c9';
UPDATE public.vesting_schedules SET onchain_schedule_id = 1 WHERE tx_hash = '0x6ee7d08cfad861650dfb320ae218be6ccfea62ed56c73b23dd74872740800e7f';
UPDATE public.vesting_schedules SET onchain_schedule_id = 2 WHERE tx_hash = '0x2cd833b7893126ced91b2fa1be275af10407239cc4c65a820900e23eddad81e5';
UPDATE public.vesting_schedules SET onchain_schedule_id = 3 WHERE tx_hash = '0x279926fd89d1dc3be517f1a633d4e49924cf18a8cd0aa2c7d12fe48fe390623f';
UPDATE public.vesting_schedules SET onchain_schedule_id = 4 WHERE tx_hash = '0xa29a74433e937c48182168217e5a40de10eae7d9a46aa41f2fd458c7f22d3e30';