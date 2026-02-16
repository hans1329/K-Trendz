-- wiki_entries에 community_name 컬럼 추가
ALTER TABLE public.wiki_entries 
ADD COLUMN IF NOT EXISTS community_name TEXT;

-- support_proposals에 proposal_category 컬럼 추가 (community_naming, budget, general 등)
ALTER TABLE public.support_proposals 
ADD COLUMN IF NOT EXISTS proposal_category TEXT DEFAULT 'general';

-- 커뮤니티 이름 선정 결과 저장용 컬럼 추가
ALTER TABLE public.support_proposals 
ADD COLUMN IF NOT EXISTS selected_result TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_support_proposals_category ON public.support_proposals(proposal_category);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_community_name ON public.wiki_entries(community_name);

-- proposal_type에 'community_naming' 값을 쉽게 구별하기 위한 코멘트
COMMENT ON COLUMN public.support_proposals.proposal_category IS 'Category of proposal: general, community_naming, budget, etc.';