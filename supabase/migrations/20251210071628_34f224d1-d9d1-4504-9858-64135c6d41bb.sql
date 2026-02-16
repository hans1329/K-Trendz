-- 소유권 신청 테이블 생성
CREATE TABLE public.owner_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_entry_id uuid NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  twitter_handle text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, user_id)
);

-- RLS 활성화
ALTER TABLE public.owner_applications ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view their own applications"
ON public.owner_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON public.owner_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create applications"
ON public.owner_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update applications"
ON public.owner_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete applications"
ON public.owner_applications FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 인덱스 생성
CREATE INDEX idx_owner_applications_status ON public.owner_applications(status);
CREATE INDEX idx_owner_applications_user_id ON public.owner_applications(user_id);
CREATE INDEX idx_owner_applications_wiki_entry_id ON public.owner_applications(wiki_entry_id);