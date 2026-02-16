-- Step 2: wiki_entry_roles 테이블 생성 및 함수/정책 추가

-- 1. wiki_entry_roles 테이블 생성 (특정 엔트리에 대한 역할)
CREATE TABLE IF NOT EXISTS public.wiki_entry_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_entry_id uuid NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL CHECK (role IN ('entry_agent', 'entry_moderator')),
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wiki_entry_id, user_id, role)
);

ALTER TABLE public.wiki_entry_roles ENABLE ROW LEVEL SECURITY;

-- 2. 엔트리별 역할 확인 함수
CREATE OR REPLACE FUNCTION public.has_wiki_entry_role(_user_id uuid, _wiki_entry_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wiki_entry_roles
    WHERE user_id = _user_id
      AND wiki_entry_id = _wiki_entry_id
      AND role = _role
  )
$$;

-- 3. 사용자 레벨 확인 함수
CREATE OR REPLACE FUNCTION public.get_user_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(current_level, 1)
  FROM public.profiles
  WHERE id = _user_id
$$;

-- 4. 엔트리 수정 권한 확인 함수
CREATE OR REPLACE FUNCTION public.can_edit_wiki_entry(_user_id uuid, _wiki_entry_id uuid, _edit_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_level integer;
  is_admin boolean;
  is_entry_agent boolean;
  is_entry_moderator boolean;
BEGIN
  -- 관리자 체크
  is_admin := public.has_role(_user_id, 'admin');
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- 엔트리 에이전트 체크
  is_entry_agent := public.has_wiki_entry_role(_user_id, _wiki_entry_id, 'entry_agent');
  
  -- 엔트리 모더레이터 체크
  is_entry_moderator := public.has_wiki_entry_role(_user_id, _wiki_entry_id, 'entry_moderator');
  
  -- 사용자 레벨 가져오기
  user_level := public.get_user_level(_user_id);
  
  -- 편집 타입별 권한 체크
  IF _edit_type = 'content' THEN
    -- 내용 수정: 레벨3 이상, 엔트리 모더레이터, 엔트리 에이전트
    RETURN user_level >= 3 OR is_entry_moderator OR is_entry_agent;
  ELSIF _edit_type = 'members' OR _edit_type = 'relationships' THEN
    -- 멤버/관계 수정: 엔트리 에이전트만
    RETURN is_entry_agent;
  ELSIF _edit_type = 'delete_post' THEN
    -- 글 삭제: 엔트리 모더레이터, 엔트리 에이전트
    RETURN is_entry_moderator OR is_entry_agent;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 5. RLS 정책
CREATE POLICY "Admins and entry agents can view wiki entry roles"
ON public.wiki_entry_roles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_wiki_entry_role(auth.uid(), wiki_entry_id, 'entry_agent')
);

CREATE POLICY "Admins can assign entry agents and moderators"
ON public.wiki_entry_roles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Entry agents can assign entry moderators"
ON public.wiki_entry_roles
FOR INSERT
WITH CHECK (
  public.has_wiki_entry_role(auth.uid(), wiki_entry_id, 'entry_agent') AND
  role = 'entry_moderator'
);

CREATE POLICY "Admins and assigners can remove roles"
ON public.wiki_entry_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR
  assigned_by = auth.uid()
);

-- 6. wiki_entries 테이블의 RLS 정책 업데이트
DROP POLICY IF EXISTS "Authenticated users can update wiki entries" ON public.wiki_entries;

CREATE POLICY "Users with permission can update wiki entries"
ON public.wiki_entries
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR
    public.can_edit_wiki_entry(auth.uid(), id, 'content')
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR
    public.can_edit_wiki_entry(auth.uid(), id, 'content')
  )
);