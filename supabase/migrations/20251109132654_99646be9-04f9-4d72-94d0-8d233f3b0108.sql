-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage settings
CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Everyone can view settings
CREATE POLICY "System settings are viewable by everyone"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Insert default wiki creation level setting
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'wiki_creation_min_level',
  '{"min_level": 1}'::jsonb,
  'Minimum user level required to create wiki entries'
)
ON CONFLICT (setting_key) DO NOTHING;