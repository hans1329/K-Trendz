-- =====================================================
-- 남은 과도하게 허용된 정책들 삭제
-- (모두 Edge Function/DB Trigger로만 처리되는 테이블)
-- =====================================================

-- ai_data_contributions
DROP POLICY IF EXISTS "System can insert AI contributions" ON public.ai_data_contributions;

-- entry_community_funds
DROP POLICY IF EXISTS "System can manage community funds" ON public.entry_community_funds;

-- entry_fund_transactions
DROP POLICY IF EXISTS "System can insert fund transactions" ON public.entry_fund_transactions;

-- external_challenge_participations
DROP POLICY IF EXISTS "Service role can insert external challenge participations" ON public.external_challenge_participations;
DROP POLICY IF EXISTS "Service role can update external challenge participations" ON public.external_challenge_participations;

-- external_wallet_users
DROP POLICY IF EXISTS "Service role can insert external wallet users" ON public.external_wallet_users;
DROP POLICY IF EXISTS "Service role can update external wallet users" ON public.external_wallet_users;

-- fanz_balances
DROP POLICY IF EXISTS "System can insert balances" ON public.fanz_balances;
DROP POLICY IF EXISTS "System can update balances" ON public.fanz_balances;

-- invitation_code_uses
DROP POLICY IF EXISTS "System can insert code uses" ON public.invitation_code_uses;

-- invitation_codes
DROP POLICY IF EXISTS "System can update invitation codes" ON public.invitation_codes;

-- onchain_scan_state
DROP POLICY IF EXISTS "System can manage scan state" ON public.onchain_scan_state;

-- onchain_tx_cache
DROP POLICY IF EXISTS "System can manage tx cache" ON public.onchain_tx_cache;

-- onchain_vote_cache
DROP POLICY IF EXISTS "System can manage onchain vote cache" ON public.onchain_vote_cache;

-- user_gift_badge_inventory (중복 정책 삭제 - 이전에 새 정책 생성함)
DROP POLICY IF EXISTS "System can insert inventory" ON public.user_gift_badge_inventory;

-- wiki_entry_user_contributions
DROP POLICY IF EXISTS "System can insert contributions" ON public.wiki_entry_user_contributions;
DROP POLICY IF EXISTS "System can update contributions" ON public.wiki_entry_user_contributions;

-- master_applications (기존 Anyone 정책 삭제)
DROP POLICY IF EXISTS "Anyone can submit master applications" ON public.master_applications;