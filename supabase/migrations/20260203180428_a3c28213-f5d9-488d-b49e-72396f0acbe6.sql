-- Store last-seen login IP per user (admin-only)

CREATE TABLE IF NOT EXISTS public.user_login_ips (
  user_id UUID PRIMARY KEY,
  last_ip TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_ips_last_seen_at
  ON public.user_login_ips (last_seen_at DESC);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_user_login_ips_updated_at ON public.user_login_ips;
CREATE TRIGGER trg_user_login_ips_updated_at
BEFORE UPDATE ON public.user_login_ips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: IP is PII, restrict reads to admins only
ALTER TABLE public.user_login_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read login IPs" ON public.user_login_ips;
CREATE POLICY "Admins can read login IPs"
ON public.user_login_ips
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

-- No INSERT/UPDATE/DELETE policies: direct client writes are denied by default.
