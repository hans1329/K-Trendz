-- 관리자가 모든 wiki_entry_votes를 볼 수 있도록 RLS 정책 추가
CREATE POLICY "Admins can view all wiki entry votes"
  ON public.wiki_entry_votes
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 누구나 wiki_entry_votes 수를 볼 수 있도록 정책 추가 (투표 수 표시용)
CREATE POLICY "Anyone can view wiki entry votes for counting"
  ON public.wiki_entry_votes
  FOR SELECT
  USING (true);