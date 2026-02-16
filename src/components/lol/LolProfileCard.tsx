import { X, Volume2, VolumeX } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import coachAvatar from "@/assets/lol/coach-avatar.webp";
import { Switch } from "@/components/ui/switch";

interface UserData {
  id: number;
  name: string;
  avatar: string;
  tier: string;
  tierIcon: string;
  level: number;
  type: string;
  description: string;
  advancedStats?: {
    radarData: Array<{ stat: string; value: number; fullMark: number }>;
  } | null;
}

// 봇(코치) 프로필 데이터 - 만랩
const coachProfile = {
  id: 0,
  name: "롤의 제왕",
  avatar: coachAvatar,
  tier: "CHALLENGER",
  tierIcon: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/challenger.png",
  level: 999,
  type: "AI Coach",
  description: "Master of all knowledge",
  advancedStats: {
    radarData: [
      { stat: "Laning", value: 100, fullMark: 100 },
      { stat: "Combat", value: 100, fullMark: 100 },
      { stat: "Vision", value: 100, fullMark: 100 },
      { stat: "Farm", value: 100, fullMark: 100 },
      { stat: "Survival", value: 100, fullMark: 100 },
      { stat: "Objective", value: 100, fullMark: 100 },
    ],
  },
};

interface LolProfileCardProps {
  user: UserData | null;
  isCoach?: boolean;
  onClose: () => void;
  ttsEnabled?: boolean;
  onTtsToggle?: (enabled: boolean) => void;
  isSpeaking?: boolean;
}

const LolProfileCard = ({ user, isCoach = false, onClose, ttsEnabled = false, onTtsToggle, isSpeaking = false }: LolProfileCardProps) => {
  const profileData = isCoach ? coachProfile : user;
  
  if (!profileData) return null;

  const radarData = profileData.advancedStats?.radarData || [
    { stat: "Laning", value: 0, fullMark: 100 },
    { stat: "Combat", value: 0, fullMark: 100 },
    { stat: "Vision", value: 0, fullMark: 100 },
    { stat: "Farm", value: 0, fullMark: 100 },
    { stat: "Survival", value: 0, fullMark: 100 },
    { stat: "Objective", value: 0, fullMark: 100 },
  ];

  // 코치일 경우 골드 테마, 아니면 청록색 테마
  const accentColor = isCoach ? "#C89B3C" : "#0AC8B9";
  const borderColor = isCoach ? "border-[#C89B3C]" : "border-[#0AC8B9]";
  const ringColor = isCoach ? "ring-[#C89B3C]" : "ring-[#0AC8B9]";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-sm my-auto bg-[#0A0E13] border-2 ${borderColor} rounded-lg shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 배경 장식 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#C89B3C]/30 via-transparent to-[#0AC8B9]/30" />
        </div>

        {/* 닫기 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-[#1E2328] hover:bg-[#463714] transition-colors"
        >
          <X className="w-4 h-4 text-[#A09B8C]" />
        </button>

        {/* 상단 프로필 */}
        <div className="relative p-6 pb-4 text-center border-b border-[#463714]/50">
          {/* 아바타 */}
          <div className={`relative inline-block mb-3 ring-4 ${ringColor} ring-offset-4 ring-offset-[#0A0E13] rounded-full`}>
            <div className="w-20 h-20 rounded-full overflow-hidden">
              <img 
                src={profileData.avatar} 
                alt={profileData.name} 
                className="w-full h-full object-cover"
              />
            </div>
            {/* 레벨 뱃지 */}
            <div 
              className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold text-[#010A13]"
              style={{ backgroundColor: accentColor }}
            >
              Lv.{profileData.level}
            </div>
          </div>

          {/* 이름 & 티어 */}
          <h3 className="text-xl font-bold text-[#F0E6D2] mb-1">{profileData.name}</h3>
          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src={profileData.tierIcon} 
              alt={profileData.tier}
              className="w-6 h-6"
            />
            <span 
              className="text-sm font-semibold tracking-wider"
              style={{ color: accentColor }}
            >
              {profileData.tier}
            </span>
          </div>
          <p className="text-xs text-[#5B5A56]">{profileData.description}</p>
          
          {/* TTS 토글 - 코치 프로필일 때만 표시 */}
          {isCoach && onTtsToggle && (
            <div className="mt-4 flex items-center justify-center gap-3 bg-[#1E2328]/50 rounded-lg p-3 border border-[#463714]/50">
              <div className="flex items-center gap-2">
                {ttsEnabled ? (
                  <Volume2 className={`w-5 h-5 text-[#0AC8B9] ${isSpeaking ? 'animate-pulse' : ''}`} />
                ) : (
                  <VolumeX className="w-5 h-5 text-[#5B5A56]" />
                )}
                <span className={`text-sm font-medium ${ttsEnabled ? 'text-[#F0E6D2]' : 'text-[#5B5A56]'}`}>
                  음성 응답
                </span>
              </div>
              <Switch
                checked={ttsEnabled}
                onCheckedChange={(checked) => {
                  // 브라우저 오디오 정책 unlock - 사용자 클릭 시 무음 재생
                  if (checked) {
                    const audio = new Audio();
                    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
                    audio.play().catch(() => {});
                  }
                  onTtsToggle(checked);
                }}
                className="data-[state=checked]:bg-[#0AC8B9]"
              />
            </div>
          )}
        </div>

        {/* 레이더 차트 */}
        <div className="p-4">
          <h4 className="text-center text-[#C89B3C] text-xs tracking-[0.2em] uppercase mb-2">
            Performance Overview
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#463714" />
                <PolarAngleAxis 
                  dataKey="stat" 
                  tick={{ fill: '#A09B8C', fontSize: 10 }} 
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={false}
                  axisLine={false} 
                />
                <Radar 
                  name="Stats" 
                  dataKey="value" 
                  stroke={accentColor} 
                  fill={accentColor} 
                  fillOpacity={0.3} 
                  strokeWidth={2} 
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 스킬 바 */}
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {radarData.map((item) => (
              <div key={item.stat} className="flex items-center gap-2">
                <span className="w-16 text-[10px] text-[#A09B8C] truncate">{item.stat}</span>
                <div className="flex-1 h-2 bg-[#1E2328] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      item.value >= 70 ? 'bg-gradient-to-r from-[#0AC8B9] to-[#0397AB]' : 
                      item.value >= 50 ? 'bg-gradient-to-r from-[#C89B3C] to-[#785A28]' : 
                      'bg-gradient-to-r from-[#E84057] to-[#9E2A2F]'
                    }`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <span className={`w-8 text-[10px] font-medium text-right ${
                  item.value >= 70 ? 'text-[#0AC8B9]' : 
                  item.value >= 50 ? 'text-[#C89B3C]' : 
                  'text-[#E84057]'
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 뱃지/타입 */}
        <div className="px-4 pb-4">
          <div 
            className="text-center py-2 rounded text-xs font-semibold tracking-wider"
            style={{ 
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}50`
            }}
          >
            {profileData.type}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LolProfileCard;
