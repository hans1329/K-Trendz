-- wiki_entry_votes에 vote_date 컬럼 추가
ALTER TABLE public.wiki_entry_votes 
ADD COLUMN vote_date date NOT NULL DEFAULT CURRENT_DATE;

-- 기존 unique constraint 삭제
ALTER TABLE public.wiki_entry_votes 
DROP CONSTRAINT wiki_entry_votes_user_id_wiki_entry_id_key;

-- 새로운 unique constraint 추가 (user_id, wiki_entry_id, vote_date)
ALTER TABLE public.wiki_entry_votes 
ADD CONSTRAINT wiki_entry_votes_user_id_wiki_entry_id_vote_date_key 
UNIQUE (user_id, wiki_entry_id, vote_date);

-- 인덱스 추가 for 빠른 조회
CREATE INDEX idx_wiki_entry_votes_user_date 
ON public.wiki_entry_votes (user_id, vote_date);