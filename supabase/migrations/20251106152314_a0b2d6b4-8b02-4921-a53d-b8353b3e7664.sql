-- 삭제된 포스트와 연결된 고아 캘린더 이벤트들 정리
DELETE FROM calendar_events
WHERE event_type = 'other'
  AND metadata->>'post_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts p 
    WHERE p.id::text = metadata->>'post_id'
  );