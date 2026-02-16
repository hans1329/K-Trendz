-- Update can_edit_wiki_entry function to use dynamic level from system_settings
CREATE OR REPLACE FUNCTION public.can_edit_wiki_entry(_user_id uuid, _wiki_entry_id uuid, _edit_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_level integer;
  is_admin boolean;
  is_entry_agent boolean;
  is_entry_moderator boolean;
  is_creator boolean;
  min_level_required integer;
BEGIN
  -- 관리자 체크
  is_admin := public.has_role(_user_id, 'admin');
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- 생성자 체크 (본인이 만든 엔트리인지)
  SELECT EXISTS (
    SELECT 1 FROM wiki_entries
    WHERE id = _wiki_entry_id AND creator_id = _user_id
  ) INTO is_creator;
  
  -- 본인이 만든 엔트리는 항상 수정 가능
  IF is_creator THEN
    RETURN true;
  END IF;
  
  -- 엔트리 에이전트 체크
  is_entry_agent := public.has_wiki_entry_role(_user_id, _wiki_entry_id, 'entry_agent');
  
  -- 엔트리 모더레이터 체크
  is_entry_moderator := public.has_wiki_entry_role(_user_id, _wiki_entry_id, 'entry_moderator');
  
  -- 사용자 레벨 가져오기
  user_level := public.get_user_level(_user_id);
  
  -- system_settings에서 최소 레벨 가져오기
  SELECT COALESCE((setting_value->>'min_level')::integer, 1) INTO min_level_required
  FROM system_settings
  WHERE setting_key = 'wiki_creation_min_level';
  
  -- 편집 타입별 권한 체크
  IF _edit_type = 'content' THEN
    -- 내용 수정: 설정된 레벨 이상, 엔트리 모더레이터, 엔트리 에이전트
    RETURN user_level >= min_level_required OR is_entry_moderator OR is_entry_agent;
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
$function$;