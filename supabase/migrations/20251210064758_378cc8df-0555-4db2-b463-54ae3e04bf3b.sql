-- 기존 유저들을 모두 invitation_verified = true로 설정
UPDATE public.profiles
SET invitation_verified = true
WHERE invitation_verified = false;