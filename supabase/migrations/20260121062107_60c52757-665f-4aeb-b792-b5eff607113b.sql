-- profiles 테이블에 LoL TTS 활성화 여부 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lol_tts_enabled boolean DEFAULT false;