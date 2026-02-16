
-- 응원봉 보유자인데 has_lightstick이 false로 잘못 기록된 참여자 수정
UPDATE challenge_participations 
SET has_lightstick = true 
WHERE id IN (
  '2a787735-2744-4453-b4d9-0f901eb789c5',
  '0e7d9d33-0f26-45a9-974a-968c0f5236ff'
);
