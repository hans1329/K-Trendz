INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('agent_generate_cost', '{"cost": 3}', 'Star cost for manual agent message generation')
ON CONFLICT (setting_key) DO NOTHING;