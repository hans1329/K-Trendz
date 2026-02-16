-- challenge와 wiki_entry 간의 다대다 관계를 위한 조인 테이블 생성
CREATE TABLE public.challenge_wiki_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  wiki_entry_id uuid NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, wiki_entry_id)
);

-- RLS 활성화
ALTER TABLE public.challenge_wiki_entries ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
CREATE POLICY "Anyone can view challenge wiki entries"
ON public.challenge_wiki_entries
FOR SELECT
USING (true);

-- 관리자만 관리 가능
CREATE POLICY "Admins can manage challenge wiki entries"
ON public.challenge_wiki_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));