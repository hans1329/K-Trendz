-- 잘못된 creator_id를 가진 데이터 확인 및 수정
-- 먼저 00000000-0000-0000-0000-000000000000 같은 잘못된 ID를 NULL로 변경
UPDATE public.wiki_entries
SET last_edited_by = NULL
WHERE last_edited_by = '00000000-0000-0000-0000-000000000000'
   OR last_edited_by NOT IN (SELECT id FROM public.profiles);

-- creator_id는 필수이므로 profiles에 존재하는 첫 번째 사용자로 변경
UPDATE public.wiki_entries
SET creator_id = (SELECT id FROM public.profiles LIMIT 1)
WHERE creator_id = '00000000-0000-0000-0000-000000000000'
   OR creator_id NOT IN (SELECT id FROM public.profiles);

-- wiki_entries 테이블에 profiles 테이블로의 foreign key 추가
ALTER TABLE public.wiki_entries
ADD CONSTRAINT wiki_entries_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.wiki_entries
ADD CONSTRAINT wiki_entries_last_edited_by_fkey 
FOREIGN KEY (last_edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;