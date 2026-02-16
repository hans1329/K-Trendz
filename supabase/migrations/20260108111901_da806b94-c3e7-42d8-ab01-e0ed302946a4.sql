-- ktnz_to_stars_rate 설정 추가
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'ktnz_to_stars_rate',
  '{"rate": 10}'::jsonb,
  'KTNZ to Stars exchange rate (1 KTNZ = X Stars)'
);