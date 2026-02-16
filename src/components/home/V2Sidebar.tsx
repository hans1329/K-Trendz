import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Heart, Calendar, FileText, TrendingUp, ChevronRight, ChevronLeft, Coins, Sparkles, Bot, MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import V2ProfileOverlay from "./V2ProfileOverlay";

// 메인 메뉴: Home, Support, Events, Posts, Rewards
const mainNavItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Support", url: "/support", icon: Heart },
  { title: "Events", url: "/challenges", icon: Calendar },
  { title: "Posts", url: "/posts", icon: FileText },
  { title: "Bot Club", url: "/agent-chat", icon: MessageSquare, badge: "Beta" },
  { title: "Rewards", url: "/earn", icon: Coins },
];

// Discover 섹션: Rising Stars, Trending, Bot Trading
const discoverItems = [
  { title: "Rising Stars", url: "/discover", icon: Sparkles },
  { title: "Trending", url: "/trending", icon: TrendingUp },
  { title: "Bot Trading", url: "/bot-trading", icon: Bot },
];

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
    staleTime: 60_000,
  });
};

const V2Sidebar = () => {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { user, profile } = useAuth();
  const collapsed = state === "collapsed";
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: hasActiveSpecialEvent } = useActiveSpecialEvent();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path.includes("?")) {
      const [pathname, search] = path.split("?");
      return location.pathname === pathname && location.search.includes(search);
    }
    // Events: /challenges와 /special-event 모두 활성 표시
    if (path === "/challenges") return location.pathname.startsWith("/challenges") || location.pathname.startsWith("/special-event");
    return location.pathname.startsWith(path);
  };

  // Events 메뉴의 실제 이동 경로 결정
  const getResolvedUrl = (url: string) => {
    if (url === "/challenges" && hasActiveSpecialEvent) return "/special-event";
    return url;
  };

  return (
    <>
      <Sidebar
        className={cn(
          "border-r border-border bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
        collapsible="icon"
      >
        {/* 로고 헤더 - PC 상단 헤더(h-[68px])와 높이 통일 */}
        <SidebarHeader className={cn("h-[68px] border-b border-border justify-center", collapsed ? "px-2" : "px-4")}>
          <Link to="/" className={cn("flex items-center", collapsed && "justify-center")}>
            {collapsed ? (
              <img 
                src="https://auth.k-trendz.com/storage/v1/object/public/brand_assets/logo_m.png" 
                alt="KTRENDZ" 
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <img 
                src="https://jguylowswwgjvotdcsfj.supabase.co/storage/v1/object/public/brand_assets/logo_l.webp" 
                alt="KTRENDZ" 
                className="h-7 w-auto"
              />
            )}
          </Link>
        </SidebarHeader>

        <SidebarContent className={cn("py-4", collapsed ? "px-0" : "px-2")}>
          {/* 메인 네비게이션 */}
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs text-muted-foreground px-3 mb-2">
                Menu
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={getResolvedUrl(item.url)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                            collapsed && "justify-center px-0",
                            active
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          {!collapsed && (
                            <span className="inline-flex items-baseline gap-1">
                              {item.title}
                              {(item as any).badge && (
                                <span className="text-[10px] italic text-primary/70 inline-block" style={{ fontFamily: 'Georgia, serif' }}>
                                  {(item as any).badge}
                                </span>
                              )}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* 디스커버 섹션 */}
          <SidebarGroup className="mt-6">
            {!collapsed && (
              <SidebarGroupLabel className="text-xs text-muted-foreground px-3 mb-2">
                Discover
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {discoverItems.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.url}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                            collapsed && "justify-center px-0",
                            active
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* 접기/펼치기 버튼 */}
        <div className="px-3 pt-2">
          <button
            onClick={() => toggleSidebar()}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>

        {/* 푸터: 유저 프로필 또는 로그인 */}
        <SidebarFooter className="p-3 border-t border-border">
          {user ? (
            <button
              onClick={() => setProfileOpen(true)}
              className={cn(
                "flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors w-full text-left",
                collapsed && "justify-center"
              )}
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {profile?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.display_name || profile?.username || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{profile?.username || "user"}
                  </p>
                </div>
              )}
              {!collapsed && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
          ) : (
            <Link to="/auth">
              <Button
                variant="default"
                className={cn(
                  "w-full rounded-full",
                  collapsed ? "px-2" : ""
                )}
              >
                {collapsed ? <Home className="w-4 h-4" /> : "Sign In"}
              </Button>
            </Link>
          )}
        </SidebarFooter>
      </Sidebar>

      {/* 프로필 오버레이 */}
      <V2ProfileOverlay open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
};

export default V2Sidebar;
