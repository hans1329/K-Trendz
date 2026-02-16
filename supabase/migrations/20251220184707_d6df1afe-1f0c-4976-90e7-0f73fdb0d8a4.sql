-- posts 테이블에 slug 컬럼 추가
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slug TEXT;

-- slug에 unique index 생성
CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_unique_idx ON public.posts(slug) WHERE slug IS NOT NULL;

-- slug 생성 함수: short_id + slugified_title
CREATE OR REPLACE FUNCTION generate_post_slug(post_id UUID, post_title TEXT)
RETURNS TEXT AS $$
DECLARE
  short_id TEXT;
  slug_title TEXT;
BEGIN
  -- UUID 앞 8자리 추출
  short_id := LEFT(post_id::TEXT, 8);
  
  -- 제목을 slug로 변환 (영문, 숫자, 한글만 허용, 공백은 하이픈으로)
  slug_title := LOWER(TRIM(post_title));
  slug_title := REGEXP_REPLACE(slug_title, '[^a-z0-9가-힣\s-]', '', 'g');
  slug_title := REGEXP_REPLACE(slug_title, '\s+', '-', 'g');
  slug_title := REGEXP_REPLACE(slug_title, '-+', '-', 'g');
  slug_title := TRIM(BOTH '-' FROM slug_title);
  
  -- 최대 50자로 제한
  IF LENGTH(slug_title) > 50 THEN
    slug_title := LEFT(slug_title, 50);
    slug_title := TRIM(BOTH '-' FROM slug_title);
  END IF;
  
  RETURN short_id || '-' || slug_title;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 새 포스트 생성 시 자동으로 slug 생성하는 트리거
CREATE OR REPLACE FUNCTION set_post_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_post_slug(NEW.id, NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 트리거 생성 (이미 있으면 교체)
DROP TRIGGER IF EXISTS set_post_slug_trigger ON public.posts;
CREATE TRIGGER set_post_slug_trigger
  BEFORE INSERT OR UPDATE OF title ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION set_post_slug();

-- 기존 포스트들에 slug 생성
UPDATE public.posts
SET slug = generate_post_slug(id, title)
WHERE slug IS NULL;