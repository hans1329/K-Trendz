-- 태그 테이블 생성
CREATE TABLE IF NOT EXISTS public.wiki_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usage_count INTEGER NOT NULL DEFAULT 0
);

-- 위키 엔트리와 태그의 관계 테이블
CREATE TABLE IF NOT EXISTS public.wiki_entry_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.wiki_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, tag_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_wiki_entry_tags_entry_id ON public.wiki_entry_tags(wiki_entry_id);
CREATE INDEX IF NOT EXISTS idx_wiki_entry_tags_tag_id ON public.wiki_entry_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_wiki_tags_slug ON public.wiki_tags(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_tags_usage_count ON public.wiki_tags(usage_count DESC);

-- RLS 활성화
ALTER TABLE public.wiki_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_entry_tags ENABLE ROW LEVEL SECURITY;

-- 태그는 모두가 볼 수 있음
CREATE POLICY "Tags are viewable by everyone"
  ON public.wiki_tags
  FOR SELECT
  USING (true);

-- 인증된 사용자는 태그 생성 가능
CREATE POLICY "Authenticated users can create tags"
  ON public.wiki_tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 위키 엔트리 태그는 모두가 볼 수 있음
CREATE POLICY "Wiki entry tags are viewable by everyone"
  ON public.wiki_entry_tags
  FOR SELECT
  USING (true);

-- 인증된 사용자는 위키 엔트리에 태그 추가 가능
CREATE POLICY "Authenticated users can add tags to wiki entries"
  ON public.wiki_entry_tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 위키 엔트리 작성자는 태그 삭제 가능
CREATE POLICY "Wiki entry creators can remove tags"
  ON public.wiki_entry_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.wiki_entries
      WHERE id = wiki_entry_tags.wiki_entry_id
      AND creator_id = auth.uid()
    )
  );

-- 태그 사용 횟수를 업데이트하는 함수
CREATE OR REPLACE FUNCTION public.update_tag_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wiki_tags
    SET usage_count = usage_count + 1
    WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wiki_tags
    SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 태그 사용 횟수 업데이트 트리거
CREATE TRIGGER update_tag_usage_count_trigger
AFTER INSERT OR DELETE ON public.wiki_entry_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_tag_usage_count();