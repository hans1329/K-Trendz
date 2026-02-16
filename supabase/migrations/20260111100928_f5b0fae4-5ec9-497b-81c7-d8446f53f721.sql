-- Add show_wallet_menu setting to system_settings
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'show_wallet_menu',
  '{"enabled": false}',
  'Controls visibility of K-Trendz Wallet menu item for users'
)
ON CONFLICT (setting_key) DO NOTHING;