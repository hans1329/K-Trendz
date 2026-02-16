import { Star, Trophy } from "lucide-react";

interface LolProgressBarProps {
  currentXp: number;
  currentLevel: number;
  missionsCompleted: number;
  badges: { icon: string; name: string; color: string }[];
}

// 레벨업에 필요한 XP 계산 (레벨당 50XP 증가)
const getXpForLevel = (level: number) => level * 50;

export const LolProgressBar = ({ currentXp, currentLevel, missionsCompleted, badges }: LolProgressBarProps) => {
  const xpForNextLevel = getXpForLevel(currentLevel);
  const xpInCurrentLevel = currentXp % xpForNextLevel;
  const progressPercent = Math.min((xpInCurrentLevel / xpForNextLevel) * 100, 100);
  
  return (
    <div className="bg-[#0A0E13] border border-[#463714]/50 rounded-lg p-4">
      {/* 레벨 & XP */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#C89B3C] to-[#785A28] flex items-center justify-center">
            <span className="text-[#010A13] font-bold text-lg">{currentLevel}</span>
          </div>
          <div>
            <p className="text-[#F0E6D2] font-medium">Level {currentLevel}</p>
            <p className="text-xs text-[#A09B8C]">{currentXp} XP 총 획득</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-[#C89B3C]">
          <Trophy className="w-4 h-4" />
          <span className="text-sm font-medium">{missionsCompleted} 미션 완료</span>
        </div>
      </div>
      
      {/* XP 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-[#A09B8C] mb-1">
          <span>다음 레벨까지</span>
          <span>{xpInCurrentLevel} / {xpForNextLevel} XP</span>
        </div>
        <div className="h-3 bg-[#1E2328] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#C89B3C] to-[#F0E6D2] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      
      {/* 획득한 뱃지 */}
      {badges.length > 0 && (
        <div>
          <p className="text-xs text-[#A09B8C] mb-2">획득한 뱃지</p>
          <div className="flex gap-2 flex-wrap">
            {badges.map((badge, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                style={{ backgroundColor: `${badge.color}20`, border: `1px solid ${badge.color}50` }}
                title={badge.name}
              >
                <span>{badge.icon}</span>
                <span style={{ color: badge.color }}>{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {badges.length === 0 && (
        <div className="text-center py-2">
          <p className="text-xs text-[#5B5A56]">미션을 완료하고 뱃지를 획득하세요!</p>
        </div>
      )}
    </div>
  );
};
