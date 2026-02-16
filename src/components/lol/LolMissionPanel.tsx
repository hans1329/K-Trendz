import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LolMissionCard } from "./LolMissionCard";
import { LolProgressBar } from "./LolProgressBar";
import { ChevronDown, ChevronUp, Target } from "lucide-react";

interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_reward: number;
  icon: string;
}

interface UserMission {
  mission_id: string;
  status: string;
}

interface UserBadge {
  badge: {
    icon: string;
    name: string;
    color: string;
  };
}

interface UserProgress {
  current_xp: number;
  current_level: number;
  missions_completed: number;
}

interface LolMissionPanelProps {
  onMissionComplete?: (message: string) => void;
}

export const LolMissionPanel = ({ onMissionComplete }: LolMissionPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [userMissions, setUserMissions] = useState<UserMission[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [progress, setProgress] = useState<UserProgress>({ current_xp: 0, current_level: 1, missions_completed: 0 });
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 미션 목록 가져오기
      const { data: missionsData } = await supabase
        .from('lol_missions')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });
      
      if (missionsData) setMissions(missionsData);

      // 로그인 유저 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // 유저 진행 상황
      const { data: progressData } = await supabase
        .from('lol_user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (progressData) {
        setProgress({
          current_xp: progressData.current_xp,
          current_level: progressData.current_level,
          missions_completed: progressData.missions_completed,
        });
      }

      // 유저 미션 상태
      const { data: userMissionsData } = await supabase
        .from('lol_user_missions')
        .select('mission_id, status')
        .eq('user_id', user.id);
      
      if (userMissionsData) setUserMissions(userMissionsData);

      // 유저 뱃지
      const { data: badgesData } = await supabase
        .from('lol_user_badges')
        .select('badge:lol_badges(icon, name, color)')
        .eq('user_id', user.id);
      
      if (badgesData) setUserBadges(badgesData as unknown as UserBadge[]);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startMission = async (missionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "로그인이 필요해요", description: "미션을 시작하려면 로그인해주세요.", variant: "destructive" });
      return;
    }

    // 유저 진행 상황이 없으면 생성
    const { data: existingProgress } = await supabase
      .from('lol_user_progress')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingProgress) {
      await supabase.from('lol_user_progress').insert({ user_id: user.id });
    }

    const { error } = await supabase
      .from('lol_user_missions')
      .insert({ user_id: user.id, mission_id: missionId, status: 'in_progress' });

    if (error) {
      toast({ title: "오류", description: "미션 시작에 실패했어요.", variant: "destructive" });
      return;
    }

    toast({ title: "미션 시작! 🎮", description: "게임에서 미션을 완료하고 돌아오세요!" });
    fetchData();
  };

  const completeMission = async (missionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    // 미션 완료 처리
    const { error: missionError } = await supabase
      .from('lol_user_missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('mission_id', missionId);

    if (missionError) {
      toast({ title: "오류", description: "미션 완료 처리에 실패했어요.", variant: "destructive" });
      return;
    }

    // XP & 진행 상황 업데이트
    const newXp = progress.current_xp + mission.xp_reward;
    const xpForNextLevel = progress.current_level * 50;
    const newLevel = newXp >= xpForNextLevel ? progress.current_level + 1 : progress.current_level;
    const newMissionsCompleted = progress.missions_completed + 1;

    // 카테고리 점수 업데이트
    const categoryScoreField = `${mission.category}_score`;
    
    const { error: progressError } = await supabase
      .from('lol_user_progress')
      .update({ 
        current_xp: newXp,
        current_level: newLevel,
        missions_completed: newMissionsCompleted,
        [categoryScoreField]: progress.missions_completed + 1,
      })
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Progress update error:', progressError);
    }

    // 다음 추천 미션 찾기
    const nextMission = availableMissions.find(m => m.id !== missionId);
    
    // 봇 메시지 생성
    const categoryLabels: Record<string, string> = {
      laning: '라인전',
      combat: '전투',
      vision: '시야',
      resource: '자원',
    };
    
    let botMessage = `🎉 **${mission.title}** 미션 완료!\n\n`;
    botMessage += `**+${mission.xp_reward} XP** 획득! `;
    
    if (newLevel > progress.current_level) {
      botMessage += `\n\n🏆 **레벨 업!** Level ${progress.current_level} → **Level ${newLevel}**\n`;
      botMessage += `축하해요! 실력이 점점 늘고 있어요!`;
    } else {
      const remainingXp = (newLevel * 50) - newXp;
      botMessage += `다음 레벨까지 ${remainingXp}XP 남았어요.`;
    }
    
    botMessage += `\n\n📊 **현재 진행 상황**\n`;
    botMessage += `• 완료한 미션: ${newMissionsCompleted}개\n`;
    botMessage += `• 총 XP: ${newXp}\n`;
    
    if (nextMission) {
      botMessage += `\n🎯 **다음 추천 미션**\n`;
      botMessage += `**${nextMission.title}** (${categoryLabels[nextMission.category] || nextMission.category})\n`;
      botMessage += `${nextMission.description}\n`;
      botMessage += `보상: +${nextMission.xp_reward} XP`;
    }
    
    // 콜백 호출
    if (onMissionComplete) {
      onMissionComplete(botMessage);
    }

    // 레벨업 알림
    if (newLevel > progress.current_level) {
      toast({ 
        title: `🎉 레벨 업! Level ${newLevel}`, 
        description: `축하해요! 다음 레벨까지 ${newLevel * 50}XP가 필요해요.`
      });
    } else {
      toast({ 
        title: `✓ 미션 완료! +${mission.xp_reward}XP`, 
        description: mission.title 
      });
    }

    fetchData();
  };

  const getMissionStatus = (missionId: string): 'available' | 'in_progress' | 'completed' => {
    const userMission = userMissions.find(um => um.mission_id === missionId);
    if (!userMission) return 'available';
    return userMission.status as 'in_progress' | 'completed';
  };

  const activeMissions = missions.filter(m => getMissionStatus(m.id) === 'in_progress');
  const availableMissions = missions.filter(m => getMissionStatus(m.id) === 'available');

  if (isLoading) return null;

  return (
    <div className="border-t border-[#463714]/50">
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-[#0A0E13]/80 hover:bg-[#1E2328]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* 애니메이션 아이콘 */}
          <div className="relative">
            <Target className={`w-5 h-5 ${activeMissions.length > 0 ? 'text-[#0AC8B9] animate-pulse' : 'text-[#C89B3C]'}`} />
            {activeMissions.length > 0 && (
              <>
                <span className="absolute inset-0 rounded-full bg-[#0AC8B9]/30 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#0AC8B9] rounded-full animate-bounce" />
              </>
            )}
          </div>
          <span className="text-sm text-[#F0E6D2] font-medium">
            미션 & 진행상황
          </span>
          {activeMissions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#0AC8B9]/20 text-[#0AC8B9] text-xs font-semibold animate-pulse">
              {activeMissions.length} 진행중
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[#A09B8C]" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[#A09B8C] animate-bounce" />
        )}
      </button>

      {/* 확장 패널 */}
      {isExpanded && (
        <div className="p-4 bg-[#010A13]/60 backdrop-blur-sm border-t border-[#463714]/30 space-y-4 animate-fade-in max-h-[60vh] overflow-y-auto">
          {/* 진행 상황 바 */}
          <LolProgressBar
            currentXp={progress.current_xp}
            currentLevel={progress.current_level}
            missionsCompleted={progress.missions_completed}
            badges={userBadges.map(ub => ub.badge)}
          />

          {/* 진행중 미션 */}
          {activeMissions.length > 0 && (
            <div>
              <h4 className="text-xs text-[#C89B3C] tracking-wider uppercase mb-2">진행중인 미션</h4>
              <div className="space-y-2">
                {activeMissions.map(mission => (
                  <LolMissionCard
                    key={mission.id}
                    mission={mission}
                    status="in_progress"
                    isExpanded={expandedMissionId === mission.id}
                    onToggle={() => setExpandedMissionId(expandedMissionId === mission.id ? null : mission.id)}
                    onComplete={() => completeMission(mission.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 사용 가능한 미션 */}
          <div>
            <h4 className="text-xs text-[#A09B8C] tracking-wider uppercase mb-2">
              추천 미션 ({availableMissions.length})
            </h4>
            <div className="space-y-2">
              {availableMissions.slice(0, 4).map(mission => (
                <LolMissionCard
                  key={mission.id}
                  mission={mission}
                  status="available"
                  isExpanded={expandedMissionId === mission.id}
                  onToggle={() => setExpandedMissionId(expandedMissionId === mission.id ? null : mission.id)}
                  onStart={() => startMission(mission.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
