-- Create wiki_entry_relationships table for hierarchical and categorical relationships
CREATE TABLE IF NOT EXISTS public.wiki_entry_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  child_entry_id UUID NOT NULL REFERENCES public.wiki_entries(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicate relationships
  CONSTRAINT unique_relationship UNIQUE (parent_entry_id, child_entry_id, relationship_type),
  
  -- Prevent self-referencing
  CONSTRAINT no_self_reference CHECK (parent_entry_id != child_entry_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_relationships_parent ON public.wiki_entry_relationships(parent_entry_id);
CREATE INDEX idx_relationships_child ON public.wiki_entry_relationships(child_entry_id);
CREATE INDEX idx_relationships_type ON public.wiki_entry_relationships(relationship_type);

-- Enable RLS
ALTER TABLE public.wiki_entry_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Relationships are viewable by everyone"
  ON public.wiki_entry_relationships
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create relationships"
  ON public.wiki_entry_relationships
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their relationships"
  ON public.wiki_entry_relationships
  FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can update their relationships"
  ON public.wiki_entry_relationships
  FOR UPDATE
  USING (auth.uid() = created_by);

-- Common relationship types (documented for reference):
-- 'member_of': 멤버 → 그룹 (예: Jimin → BTS)
-- 'product_of': 제품 → 제조사 (예: 신라면 → 농심)
-- 'belongs_to_category': 엔트리 → 카테고리 (예: 신라면 → 라면)
-- 'sub_category_of': 하위 카테고리 → 상위 카테고리 (예: 라면 → 푸드)
-- 'sub_label_of': 서브 레이블 → 메인 레이블 (예: Big Hit → HYBE)
-- 'album_of': 앨범 → 아티스트
-- 'song_of': 곡 → 앨범
-- 'actor_in': 배우 → 드라마/영화