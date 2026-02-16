-- Fix: external_wallet_users_public must bypass RLS (while blocking direct table access)
-- Reason: security_invoker=on applies RLS, so public view returns empty and UI shows 'Anonymous'

BEGIN;

-- Recreate view WITHOUT security_invoker so it runs with view owner privileges (postgres)
DROP VIEW IF EXISTS public.external_wallet_users_public;

CREATE VIEW public.external_wallet_users_public AS
SELECT
  id,
  wallet_address,
  username,
  display_name,
  avatar_url,
  source,
  created_at
FROM public.external_wallet_users;

-- Block direct access to base table (so sensitive columns remain protected)
REVOKE ALL ON TABLE public.external_wallet_users FROM PUBLIC;
REVOKE ALL ON TABLE public.external_wallet_users FROM anon;
REVOKE ALL ON TABLE public.external_wallet_users FROM authenticated;

-- Allow read access only via the public view
GRANT SELECT ON public.external_wallet_users_public TO anon;
GRANT SELECT ON public.external_wallet_users_public TO authenticated;

COMMIT;