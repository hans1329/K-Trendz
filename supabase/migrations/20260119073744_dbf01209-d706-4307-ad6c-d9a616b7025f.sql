-- external_challenge_participations 테이블에 has_lightstick 컬럼 추가
ALTER TABLE public.external_challenge_participations
ADD COLUMN has_lightstick boolean NOT NULL DEFAULT false;