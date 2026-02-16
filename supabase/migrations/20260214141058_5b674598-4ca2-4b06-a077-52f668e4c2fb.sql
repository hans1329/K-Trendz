-- 고아 데이터 정리 후 FK 추가
DELETE FROM public.wiki_entry_followers
WHERE wiki_entry_id NOT IN (SELECT id FROM public.wiki_entries);

ALTER TABLE public.wiki_entry_followers
ADD CONSTRAINT wiki_entry_followers_wiki_entry_id_fkey
FOREIGN KEY (wiki_entry_id) REFERENCES public.wiki_entries(id) ON DELETE CASCADE;