import { Check, Clock, Star } from "lucide-react";

interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_reward: number;
  icon: string;
}

interface LolMissionCardProps {
  mission: Mission;
  status?: 'available' | 'in_progress' | 'completed';
  onStart?: () => void;
  onComplete?: () => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const difficultyColors = {
  easy: { bg: 'bg-[#0AC8B9]/20', border: 'border-[#0AC8B9]/50', text: 'text-[#0AC8B9]' },
  medium: { bg: 'bg-[#C89B3C]/20', border: 'border-[#C89B3C]/50', text: 'text-[#C89B3C]' },
  hard: { bg: 'bg-[#E84057]/20', border: 'border-[#E84057]/50', text: 'text-[#E84057]' },
};

const categoryLabels: Record<string, string> = {
  laning: '라인전',
  combat: '전투',
  vision: '시야',
  resource: '자원',
};

export const LolMissionCard = ({ 
  mission, 
  status = 'available', 
  onStart, 
  onComplete,
  isExpanded,
  onToggle 
}: LolMissionCardProps) => {
  const colors = difficultyColors[mission.difficulty as keyof typeof difficultyColors] || difficultyColors.easy;
  
  return (
    <div 
      className={`relative overflow-hidden rounded-lg transition-all duration-300 cursor-pointer ${colors.bg} ${colors.border} border ${
        status === 'completed' ? 'opacity-60' : ''
      }`}
      onClick={onToggle}
    >
      {/* 콘텐츠 */}
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* 아이콘 */}
          <div className={`w-12 h-12 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center text-2xl flex-shrink-0`}>
            {status === 'completed' ? <Check className="w-6 h-6 text-[#0AC8B9]" /> : mission.icon}
          </div>
          
          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                {categoryLabels[mission.category] || mission.category}
              </span>
              <span className={`text-xs ${colors.text}`}>
                {mission.difficulty === 'easy' ? '쉬움' : mission.difficulty === 'medium' ? '보통' : '어려움'}
              </span>
            </div>
            <h4 className="text-[#F0E6D2] font-medium text-sm truncate">{mission.title}</h4>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-[#C89B3C]" />
              <span className="text-xs text-[#C89B3C]">+{mission.xp_reward} XP</span>
            </div>
          </div>
          
          {/* 상태 표시 */}
          {status === 'in_progress' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#C89B3C]/20 border border-[#C89B3C]/50">
              <Clock className="w-3 h-3 text-[#C89B3C]" />
              <span className="text-xs text-[#C89B3C]">진행중</span>
            </div>
          )}
        </div>
        
        {/* 확장된 설명 */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#463714]/50 animate-fade-in">
            <p className="text-sm text-[#A09B8C] mb-4">{mission.description}</p>
            
            {status === 'available' && onStart && (
              <button
                onClick={(e) => { e.stopPropagation(); onStart(); }}
                className="w-full py-2 rounded bg-gradient-to-b from-[#0AC8B9] to-[#0397AB] text-[#010A13] font-semibold text-sm hover:from-[#0AC8B9]/90 hover:to-[#0397AB]/90 transition-all"
              >
                미션 시작하기
              </button>
            )}
            
            {status === 'in_progress' && onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="w-full py-2 rounded bg-gradient-to-b from-[#C89B3C] to-[#785A28] text-[#010A13] font-semibold text-sm hover:from-[#C89B3C]/90 hover:to-[#785A28]/90 transition-all"
              >
                완료하기 ✓
              </button>
            )}
            
            {status === 'completed' && (
              <div className="text-center py-2 text-[#0AC8B9] text-sm font-medium">
                ✓ 완료됨
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
