
-- 플랫폼 활동 총 카운트를 정확하게 반환하는 RPC 함수
CREATE OR REPLACE FUNCTION public.get_platform_activity_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    (SELECT COUNT(*) FROM public.post_votes) +
    (SELECT COUNT(*) FROM public.wiki_entry_votes) +
    (SELECT COUNT(*) FROM public.fanz_transactions) +
    (SELECT COUNT(*) FROM public.challenge_participations) +
    (SELECT COUNT(*) FROM public.external_challenge_participations) +
    (SELECT COUNT(*) FROM public.bot_transactions);
$$;
