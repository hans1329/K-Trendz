import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, Trophy, FileText, MessageSquare, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import V2ProfileOverlay from "./V2ProfileOverlay";

// 활성 스페셜 이벤트 존재 여부 확인 훅
const useActiveSpecialEvent = () => {
  return useQuery({
    queryKey: ['special-event-active-check'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('special_vote_events')
        .select('id')
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000, // 1분 캐시
  });
};

// 5개 탭: Support, Events, Profile(중앙), Posts, Bot Club
const tabs = [
  { id: 'support', label: 'Support', icon: Heart, path: '/support' },
  { id: 'events', label: 'Events', icon: Trophy, path: '/challenges' },
  { id: 'profile', label: 'Profile', icon: null, path: null, isCenter: true },
  { id: 'posts', label: 'Posts', icon: FileText, path: '/posts' },
  { id: 'bot-club', label: 'Bot Club', icon: MessageSquare, path: '/agent-chat' },
];

const AppTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: hasActiveSpecialEvent } = useActiveSpecialEvent();
  const [profileOpen, setProfileOpen] = useState(false);
  
  const isActive = (path: string | null, tabId?: string) => {
    if (!path) return false;
    if (path === '/') return location.pathname === '/';
    // Events 탭: /challenges와 /special-event 모두 활성 표시
    if (tabId === 'events') return location.pathname.startsWith('/challenges') || location.pathname.startsWith('/special-event');
    return location.pathname.startsWith(path);
  };

  // 프로필 버튼 클릭 핸들러
  const handleProfileClick = () => {
    if (user) {
      setProfileOpen(true);
    } else {
      navigate('/auth');
    }
  };

  return (
    <>
      <nav className="fixed bottom-2 left-3 right-3 z-50 bg-background/95 backdrop-blur-md border border-border rounded-full safe-area-bottom" style={{ transform: 'translate3d(0,0,0)', boxShadow: '0 2px 12px 4px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-evenly h-16 max-w-md mx-auto">
          {tabs.map((tab) => {
            const active = isActive(tab.path, tab.id);
            const Icon = tab.icon;
            
            // 중앙 프로필 탭 (특별 스타일) - 로그인 상태에 따라 분기
            if (tab.isCenter) {
              // 비로그인 상태 붉은 글로우 스타일
              const redGlowStyle = !user ? {
                animation: 'redGlowPulse 5s ease-in-out infinite',
              } : {};

              return (
                <button
                  key={tab.id}
                  onClick={handleProfileClick}
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <style>
                    {`
                      @keyframes redGlowPulse {
                        0%, 100% {
                          box-shadow: 0 0 4px 1px rgba(220, 38, 38, 0.1), 0 0 8px 2px rgba(220, 38, 38, 0.05);
                        }
                        50% {
                          box-shadow: 0 0 12px 4px rgba(220, 38, 38, 0.3), 0 0 24px 8px rgba(220, 38, 38, 0.15);
                        }
                      }
                    `}
                  </style>
                  <div 
                    className={cn(
                      "w-14 h-14 rounded-full border-4 transition-all duration-200 overflow-hidden",
                      profileOpen 
                        ? "border-primary shadow-lg shadow-primary/30" 
                        : "border-background shadow-md"
                    )}
                    style={redGlowStyle}
                  >
                    {user ? (
                      <Avatar className="w-full h-full">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                          {profile?.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Power className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </button>
              );
            }
            
            // Events 탭: 활성 스페셜 이벤트가 있으면 /special-event로 리다이렉트
            const resolvedPath = tab.id === 'events' && hasActiveSpecialEvent
              ? '/special-event'
              : tab.path!;

            return (
              <Link
                key={tab.id}
                to={resolvedPath}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon && <Icon className={cn(
                  "w-[22px] h-[22px] transition-transform duration-200",
                  active && "scale-110"
                )} />}
                <span className={cn(
                  "text-[8px] font-medium transition-all",
                  active && "font-semibold"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 프로필 오버레이 */}
      <V2ProfileOverlay open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
};

export default AppTabBar;
