-- LoL 코칭 미션 정의 테이블
CREATE TABLE public.lol_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'laning', 'combat', 'vision', 'resource'
  difficulty TEXT NOT NULL DEFAULT 'easy', -- 'easy', 'medium', 'hard'
  xp_reward INTEGER NOT NULL DEFAULT 10,
  tier_requirement TEXT, -- null = 모든 티어, 'bronze', 'silver', 'gold', 'platinum'
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- LoL 뱃지 정의 테이블
CREATE TABLE public.lol_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#C89B3C',
  requirement_type TEXT NOT NULL, -- 'missions_completed', 'level_reached', 'category_mastery'
  requirement_value INTEGER NOT NULL DEFAULT 1,
  requirement_category TEXT, -- 카테고리 마스터리용
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 유저별 코칭 진행 상황 테이블
CREATE TABLE public.lol_user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  laning_score INTEGER NOT NULL DEFAULT 0,
  combat_score INTEGER NOT NULL DEFAULT 0,
  vision_score INTEGER NOT NULL DEFAULT 0,
  resource_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 유저 미션 수행 기록 테이블
CREATE TABLE public.lol_user_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.lol_missions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, mission_id)
);

-- 유저 획득 뱃지 테이블
CREATE TABLE public.lol_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.lol_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- RLS 활성화
ALTER TABLE public.lol_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lol_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lol_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lol_user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lol_user_badges ENABLE ROW LEVEL SECURITY;

-- lol_missions: 모두 읽기 가능
CREATE POLICY "Anyone can view missions" ON public.lol_missions FOR SELECT USING (true);

-- lol_badges: 모두 읽기 가능
CREATE POLICY "Anyone can view badges" ON public.lol_badges FOR SELECT USING (true);

-- lol_user_progress: 본인만 접근
CREATE POLICY "Users can view own progress" ON public.lol_user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.lol_user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.lol_user_progress FOR UPDATE USING (auth.uid() = user_id);

-- lol_user_missions: 본인만 접근
CREATE POLICY "Users can view own missions" ON public.lol_user_missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own missions" ON public.lol_user_missions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own missions" ON public.lol_user_missions FOR UPDATE USING (auth.uid() = user_id);

-- lol_user_badges: 본인만 접근
CREATE POLICY "Users can view own badges" ON public.lol_user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.lol_user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at 트리거
CREATE TRIGGER update_lol_user_progress_updated_at
  BEFORE UPDATE ON public.lol_user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 초기 미션 데이터 삽입
INSERT INTO public.lol_missions (title, description, category, difficulty, xp_reward, icon) VALUES
-- 라인전 미션
('CS 10개 연속 막타', '미니언 10개를 연속으로 막타 치세요', 'laning', 'easy', 15, '⚔️'),
('15분 CS 100개 달성', '15분 안에 CS 100개를 달성하세요', 'laning', 'medium', 30, '🎯'),
('솔로킬 달성하기', '라인전에서 1:1 솔로킬을 따내세요', 'laning', 'medium', 25, '💀'),
('라인전 골드 우위', '15분에 상대보다 500골드 앞서기', 'laning', 'hard', 40, '💰'),

-- 전투 미션
('팀 싸움 참여하기', '팀 싸움에서 킬 또는 어시스트를 기록하세요', 'combat', 'easy', 10, '⚔️'),
('킬 관여율 60% 달성', '게임 킬 관여율 60% 이상 달성하기', 'combat', 'medium', 25, '🔥'),
('분당 500 데미지 넣기', 'DPM 500 이상 기록하기', 'combat', 'hard', 35, '💥'),

-- 시야 미션
('핑크와드 구매하기', '리콜 시 핑크와드를 구매하세요', 'vision', 'easy', 10, '👁️'),
('와드 3개 제거하기', '적 와드를 3개 이상 제거하세요', 'vision', 'medium', 20, '🔍'),
('비전 점수 30 달성', '게임 비전 점수 30점 이상 달성하기', 'vision', 'hard', 30, '🗺️'),

-- 자원 미션
('분당 CS 6개 유지', 'CSPM 6 이상 유지하기', 'resource', 'easy', 15, '🌾'),
('분당 CS 8개 달성', 'CSPM 8 이상 달성하기', 'resource', 'hard', 40, '🏆');

-- 초기 뱃지 데이터 삽입
INSERT INTO public.lol_badges (name, description, icon, color, requirement_type, requirement_value, requirement_category) VALUES
('루키 코치', '첫 미션을 완료했습니다', '🌟', '#0AC8B9', 'missions_completed', 1, NULL),
('열정적인 학생', '미션 5개를 완료했습니다', '📚', '#C89B3C', 'missions_completed', 5, NULL),
('성장하는 소환사', '레벨 5에 도달했습니다', '⬆️', '#5383E8', 'level_reached', 5, NULL),
('라인전 견습생', '라인전 미션 3개 완료', '⚔️', '#E84057', 'category_mastery', 3, 'laning'),
('전투의 달인', '전투 미션 3개 완료', '💥', '#F0E6D2', 'category_mastery', 3, 'combat'),
('시야 장인', '시야 미션 3개 완료', '👁️', '#0AC8B9', 'category_mastery', 3, 'vision'),
('파밍 마스터', '자원 미션 2개 완료', '🌾', '#C89B3C', 'category_mastery', 2, 'resource');