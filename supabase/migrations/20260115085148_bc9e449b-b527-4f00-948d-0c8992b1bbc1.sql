-- wiki_entry_votes 테이블에 tx_hash 컬럼 추가
ALTER TABLE public.wiki_entry_votes 
ADD COLUMN IF NOT EXISTS tx_hash TEXT;