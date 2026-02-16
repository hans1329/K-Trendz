-- 마스터 지원 테이블 생성
CREATE TABLE public.master_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id)
);

-- RLS 활성화
ALTER TABLE public.master_applications ENABLE ROW LEVEL SECURITY;

-- 누구나 지원 가능 (INSERT)
CREATE POLICY "Anyone can submit master applications"
ON public.master_applications
FOR INSERT
WITH CHECK (true);

-- 관리자만 조회 가능
CREATE POLICY "Admins can view all master applications"
ON public.master_applications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 관리자만 수정 가능
CREATE POLICY "Admins can update master applications"
ON public.master_applications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 관리자만 삭제 가능
CREATE POLICY "Admins can delete master applications"
ON public.master_applications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));