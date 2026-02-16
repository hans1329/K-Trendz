-- 페이지 상태 enum 생성
CREATE TYPE public.page_status AS ENUM ('unclaimed', 'pending', 'claimed', 'verified');

-- wiki_entries 테이블에 owner_id와 page_status 컬럼 추가
ALTER TABLE public.wiki_entries
ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN page_status public.page_status NOT NULL DEFAULT 'unclaimed';

-- 관리자가 소유권을 할당할 수 있는 함수
CREATE OR REPLACE FUNCTION public.assign_entry_owner(
  entry_id_param uuid,
  owner_id_param uuid,
  status_param page_status DEFAULT 'claimed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 관리자 권한 확인
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign entry owners';
  END IF;
  
  -- 소유권 할당
  UPDATE wiki_entries
  SET 
    owner_id = owner_id_param,
    page_status = status_param,
    updated_at = now()
  WHERE id = entry_id_param;
  
  RETURN true;
END;
$$;

-- 소유권 해제 함수
CREATE OR REPLACE FUNCTION public.revoke_entry_owner(entry_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 관리자 권한 확인
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke entry owners';
  END IF;
  
  -- 소유권 해제
  UPDATE wiki_entries
  SET 
    owner_id = NULL,
    page_status = 'unclaimed',
    updated_at = now()
  WHERE id = entry_id_param;
  
  RETURN true;
END;
$$;

-- 인덱스 추가
CREATE INDEX idx_wiki_entries_owner_id ON public.wiki_entries(owner_id);
CREATE INDEX idx_wiki_entries_page_status ON public.wiki_entries(page_status);