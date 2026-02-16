-- 현재 챌린지에서 해당 IP hash의 rate limit 기록 삭제
DELETE FROM ip_rate_limits 
WHERE ip_hash = '12a9018e87448c4f82b65938a4d44c09f3af7ed7b0585d69ccafe1c614c0c7d0'
AND action_type = 'challenge_participation'
AND reference_id = '57cac7b7-3876-44cb-9565-5b287f6d49fe';

-- 해당 fingerprint 기록도 삭제
DELETE FROM ip_rate_limits 
WHERE ip_hash LIKE 'fp_8431eb65%'
AND action_type = 'challenge_participation'
AND reference_id = '57cac7b7-3876-44cb-9565-5b287f6d49fe';