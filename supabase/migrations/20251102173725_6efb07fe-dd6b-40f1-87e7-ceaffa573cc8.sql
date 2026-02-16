-- 위키 편집 이력 테이블 생성
CREATE TABLE public.wiki_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL,
  previous_content TEXT NOT NULL,
  new_content TEXT NOT NULL,
  previous_title TEXT,
  new_title TEXT,
  edit_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- 인덱스
  CONSTRAINT fk_wiki_entry FOREIGN KEY (wiki_entry_id) REFERENCES public.wiki_entries(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_wiki_edit_history_entry ON public.wiki_edit_history(wiki_entry_id);
CREATE INDEX idx_wiki_edit_history_editor ON public.wiki_edit_history(editor_id);
CREATE INDEX idx_wiki_edit_history_created ON public.wiki_edit_history(created_at DESC);

-- RLS 활성화
ALTER TABLE public.wiki_edit_history ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 편집 이력은 모두가 볼 수 있음
CREATE POLICY "Edit history is viewable by everyone"
  ON public.wiki_edit_history
  FOR SELECT
  USING (true);

-- RLS 정책: 시스템만 편집 이력 생성 가능 (트리거로 자동 생성)
CREATE POLICY "System can insert edit history"
  ON public.wiki_edit_history
  FOR INSERT
  WITH CHECK (true);

-- 기존 wiki_entries RLS 정책 수정: 모든 로그인 사용자가 편집 가능
DROP POLICY IF EXISTS "Creators can update their wiki entries" ON public.wiki_entries;

CREATE POLICY "Authenticated users can update wiki entries"
  ON public.wiki_entries
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 편집 이력 자동 기록 트리거 함수
CREATE OR REPLACE FUNCTION public.record_wiki_edit_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 내용이나 제목이 변경된 경우에만 이력 기록
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.wiki_edit_history (
      wiki_entry_id,
      editor_id,
      previous_content,
      new_content,
      previous_title,
      new_title
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.content,
      NEW.content,
      OLD.title,
      NEW.title
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
CREATE TRIGGER record_wiki_edit_history_trigger
  AFTER UPDATE ON public.wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.record_wiki_edit_history();

-- wiki_entries 테이블에 last_edited_by 컬럼 추가
ALTER TABLE public.wiki_entries 
ADD COLUMN IF NOT EXISTS last_edited_by UUID,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;

-- 편집 시 last_edited_by 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION public.update_wiki_last_edited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_edited_by := auth.uid();
  NEW.last_edited_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_wiki_last_edited_trigger
  BEFORE UPDATE ON public.wiki_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wiki_last_edited();