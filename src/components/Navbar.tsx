import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Menu, Newspaper, TrendingUp, Star, Bookmark, Settings, LogOut, User, Shield, Pencil, DollarSign, Bell, MessageSquare, Sparkles, Clock, Calendar, Users, Wand2, Trophy, Zap, Wallet, BookOpen, Heart, Ticket, LayoutDashboard, BarChart3, Timer, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerStatus } from "@/hooks/useOwnerStatus";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAvatarThumbnail } from "@/lib/image";
const LOGO_MOBILE_URL = "https://jguylowswwgjvotdcsfj.supabase.co/storage/v1/object/public/brand_assets/logo_7.png";
const LOGO_DESKTOP_URL = "https://jguylowswwgjvotdcsfj.supabase.co/storage/v1/object/public/brand_assets/logo7.png";

interface NavbarProps {
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

const getMenuItems = (rushTabLabel: string, challengeHref: string) => [
  { icon: Timer, label: rushTabLabel, href: challengeHref, emoji: null },
  { icon: Wand2, label: "Supporters", href: "/rankings", emoji: null },
  { icon: FileText, label: "New", href: "/rankings?sort=new", emoji: null },
  // { icon: Newspaper, label: "News", href: "/?section=all" },
  { icon: Heart, label: "Watchlist", href: "/my-watchlist", emoji: null },
];

const Navbar = ({ showSearch = false, searchQuery = "", onSearchChange }: NavbarProps) => {
  const { user, profile, isAdmin, isModerator, signOut, loading } = useAuth();
  const { isOwner } = useOwnerStatus();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentSection = searchParams.get("section") || "all";
  const isMobile = useIsMobile();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [badgeInventory, setBadgeInventory] = useState<Array<{
    gift_badge_id: string;
    quantity: number;
    name: string;
    icon: string;
    color: string;
  }>>([]);
  const [dailyVotes, setDailyVotes] = useState<{
    current_count: number;
    max_votes: number;
    remaining_votes: number;
  } | null>(null);
  const [totalFanzTokens, setTotalFanzTokens] = useState(0);
  const [dailyPosts, setDailyPosts] = useState<{
    current_count: number;
    max_posts: number;
    remaining_posts: number;
  } | null>(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  // 24h Rush 이벤트 존재 여부 확인
  const { data: hasActiveRushEvent } = useQuery({
    queryKey: ['navbar-active-rush-event'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('special_vote_events')
        .select('id')
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .limit(1);
      return (data && data.length > 0);
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // 활성 챌린지 존재 여부 확인 (시작 전 챌린지도 포함)
  const { data: hasActiveChallenge } = useQuery({
    queryKey: ['navbar-active-challenge'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('challenges')
        .select('id')
        .eq('status', 'active')
        .gte('end_time', now) // 종료 시간만 체크 (시작 전도 포함)
        .limit(1);
      return (data && data.length > 0);
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // 탭 라벨 및 링크 결정: Rush 이벤트 > Challenges > Event (기본)
  const { rushTabLabel, challengeHref } = useMemo(() => {
    if (hasActiveRushEvent) {
      return { rushTabLabel: "24h Rush", challengeHref: "/special-event" };
    }
    if (hasActiveChallenge) {
      return { rushTabLabel: "Challenges", challengeHref: "/challenges" };
    }
    return { rushTabLabel: "Event", challengeHref: "/challenges" };
  }, [hasActiveRushEvent, hasActiveChallenge]);

  // 동적 메뉴 아이템
  const menuItems = useMemo(() => getMenuItems(rushTabLabel, challengeHref), [rushTabLabel, challengeHref]);

  // Wallet 메뉴 표시 여부 설정 불러오기
  useEffect(() => {
    const fetchWalletMenuSetting = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'show_wallet_menu')
        .single();
      
      if (data?.setting_value) {
        setShowWalletMenu((data.setting_value as any)?.enabled || false);
      }
    };
    
    fetchWalletMenuSetting();
  }, []);

  // 프로필 데이터에서 직접 이름/아바타를 가져옴 (캐시된 profile 사용)
  const hasProfile = !!profile;
  const displayName = profile?.display_name || profile?.username || "";
  const avatarUrl = hasProfile && profile?.avatar_url ? (getAvatarThumbnail(profile.avatar_url, 96) || profile.avatar_url) : undefined;
  
  // 프로필 이미지가 없을 때 재미있는 랜덤 아바타 생성 (username 기반으로 항상 동일한 이미지)
  const fallbackAvatar = hasProfile && !avatarUrl
    ? `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${profile?.username || user?.id || 'guest'}`
    : undefined;

  // 읽지 않은 알림 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadNotifications(count || 0);
    };

    fetchUnreadCount();

    // Realtime 구독
    const channel = supabase
      .channel('navbar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 읽지 않은 멘션 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchUnreadMentions = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'mention')
        .eq('is_read', false);

      setUnreadMentions(count || 0);
    };

    fetchUnreadMentions();

    const channel = supabase
      .channel('navbar-mentions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadMentions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 읽지 않은 메시지 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchUnreadMessages = async () => {
      // 현재 사용자가 참여한 대화 목록 가져오기
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!conversations || conversations.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const conversationIds = conversations.map(c => c.id);

      // 해당 대화들에서 읽지 않은 메시지 카운트 (내가 보낸 것 제외)
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      setUnreadMessages(count || 0);
    };

    fetchUnreadMessages();

    const channel = supabase
      .channel('navbar-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 뱃지 인벤토리 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchBadgeInventory = async () => {
      const { data, error } = await supabase
        .from('user_gift_badge_inventory')
        .select(`
          gift_badge_id,
          quantity,
          gift_badges (
            name,
            icon,
            color
          )
        `)
        .eq('user_id', user.id)
        .order('gift_badge_id');
      
      if (data) {
        const inventory = data.map((item: any) => ({
          gift_badge_id: item.gift_badge_id,
          quantity: item.quantity,
          name: item.gift_badges?.name || '',
          icon: item.gift_badges?.icon || '🎤',
          color: item.gift_badges?.color || '#FF4500',
        }));
        setBadgeInventory(inventory);
      }
    };

    fetchBadgeInventory();

    const channel = supabase
      .channel('navbar-badges')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_gift_badge_inventory',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBadgeInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fanz Token 총 개수 가져오기 (Edge Function 기반 - 모든 지갑 합산)
  useEffect(() => {
    if (!user) return;

    const fetchTotalFanzTokens = async () => {
      try {
        // 사용자의 지갑 주소 1개 조회 (Edge Function에서 모든 지갑 후보를 확장해준다)
        const { data: walletRows, error: walletError } = await supabase
          .from('wallet_addresses')
          .select('wallet_address, wallet_type')
          .eq('user_id', user.id)
          .limit(10);

        if (walletError) throw walletError;
        if (!walletRows || walletRows.length === 0) {
          setTotalFanzTokens(0);
          return;
        }

        const walletAddress =
          walletRows.find(w => w.wallet_type === 'smart_wallet')?.wallet_address ||
          walletRows[0]?.wallet_address;

        if (!walletAddress) {
          setTotalFanzTokens(0);
          return;
        }

        // Edge Function 호출 (서버에서 온체인 조회 + 모든 지갑 후보 합산)
        const { data: balanceData, error: balanceError } = await supabase.functions.invoke(
          'get-user-fanz-balances',
          {
            body: {
              walletAddress,
              userId: user.id,
              includeMeta: false, // 가격/supply 등은 필요 없음 → RPC 호출 최소화
            },
          }
        );

        if (balanceError || !balanceData?.balances) {
          console.warn('Navbar: Failed to fetch fanz balances via Edge Function');
          setTotalFanzTokens(0);
          return;
        }

        const total = (balanceData.balances as Array<{ balance: number }>).reduce(
          (sum, t) => sum + (Number(t.balance) || 0),
          0
        );

        setTotalFanzTokens(total);
      } catch (error) {
        console.error('Error fetching fanz tokens:', error);
      }
    };

    fetchTotalFanzTokens();

    // 주기적으로 새로고침 (60초마다)
    const interval = setInterval(fetchTotalFanzTokens, 60000);

    // Custom event 리스너 추가 (구매/전송 완료 시 즉시 반영)
    const handleFanzTokenUpdate = () => {
      // 온체인 반영까지 약간의 딜레이
      setTimeout(fetchTotalFanzTokens, 2000);
    };
    window.addEventListener('fanzTokenUpdated', handleFanzTokenUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('fanzTokenUpdated', handleFanzTokenUpdate);
    };
  }, [user]);

  // 결제 성공 후 리다이렉트 감지 및 즉시 데이터 업데이트
  useEffect(() => {
    if (!user) return;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // 약간의 딜레이 후 재조회 트리거
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('fanzTokenUpdated'));
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, location.pathname]);

  // 일일 투표 상태 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchDailyVoteStatus = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_daily_vote_status', { user_id_param: user.id });

        if (error) throw error;

        const voteData = data as { current_count: number; max_votes: number; remaining_votes: number; can_vote: boolean };
        setDailyVotes({
          current_count: voteData.current_count,
          max_votes: voteData.max_votes,
          remaining_votes: voteData.remaining_votes,
        });
      } catch (error) {
        console.error('Error fetching daily vote status:', error);
      }
    };

    fetchDailyVoteStatus();

    // Realtime 구독으로 투표 시 즉시 업데이트
    const channel = supabase
      .channel('navbar-daily-votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_vote_counts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDailyVoteStatus();
        }
      )
      .subscribe();

    // Custom event 리스너 추가 (다른 컴포넌트에서 투표 시 즉시 반영)
    const handleVotesUpdate = () => {
      fetchDailyVoteStatus();
    };
    window.addEventListener('dailyVotesUpdated', handleVotesUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('dailyVotesUpdated', handleVotesUpdate);
    };
  }, [user]);

  // 일일 포스트 상태 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchDailyPostStatus = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_daily_post_status', { user_id_param: user.id });

        if (error) throw error;

        if (data) {
          const postData = data as { current_count: number; max_posts: number; remaining_posts: number; can_post: boolean };
          setDailyPosts({
            current_count: postData.current_count,
            max_posts: postData.max_posts,
            remaining_posts: postData.remaining_posts,
          });
        }
      } catch (error) {
        console.error('Error fetching daily post status:', error);
        // 기본값 설정
        setDailyPosts({
          current_count: 0,
          max_posts: 10,
          remaining_posts: 10,
        });
      }
    };

    fetchDailyPostStatus();

    // Realtime 구독으로 포스트 작성 시 즉시 업데이트
    const channel = supabase
      .channel('navbar-daily-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_post_counts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDailyPostStatus();
        }
      )
      .subscribe();

    // Custom event 리스너 추가
    const handlePostsUpdate = () => {
      fetchDailyPostStatus();
    };
    window.addEventListener('dailyPostsUpdated', handlePostsUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('dailyPostsUpdated', handlePostsUpdate);
    };
  }, [user]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-sm border-b shadow-sm">
      <div className="container mx-auto px-2 md:px-4 h-12 md:h-14 flex items-center justify-between gap-2 md:gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center hover:opacity-80 transition-opacity shrink-0">
          <img 
            src={isMobile ? LOGO_MOBILE_URL : LOGO_DESKTOP_URL}
            alt="KTRENDZ" 
            className="h-7 md:h-7" 
            onError={(e) => {
              console.error('Logo failed to load');
            }}
          />
        </Link>

        {/* Mobile Menu - Icon Only - Centered */}
        <div className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-muted/50 p-1 rounded-full">
          {menuItems.map((item) => {
            const sortParam = searchParams.get("sort");
            const isActive = item.href === '/rankings?sort=new'
              ? location.pathname.startsWith('/rankings') && sortParam === 'new'
              : item.href.startsWith('/wiki')
              ? location.pathname.startsWith('/wiki')
              : item.href === '/rankings'
              ? (location.pathname === '/' || location.pathname.startsWith('/rankings') || location.pathname.match(/^\/[^/]+-top-100$/)) && sortParam !== 'new'
              : item.href === '/my-watchlist'
              ? location.pathname === '/my-watchlist'
              : false;
            
            return (
              <Link key={item.href} to={item.href}>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`h-10 w-10 rounded-full transition-all ${
                    isActive 
                      ? 'bg-card text-primary shadow-md hover:bg-card hover:text-primary' 
                      : 'text-muted-foreground hover:text-muted-foreground hover:bg-transparent'
                  }`}
                  title={item.label}
                >
                  {item.emoji ? (
                    <span className="text-xl">{item.emoji}</span>
                  ) : item.icon ? (
                    <item.icon className="w-6 h-6" />
                  ) : null}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Desktop Menu - Centered */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 bg-muted/50 p-1 rounded-full">
          {menuItems.map((item) => {
            const sortParam = searchParams.get("sort");
            const isActive = item.href === '/rankings?sort=new'
              ? location.pathname.startsWith('/rankings') && sortParam === 'new'
              : item.href.startsWith('/wiki')
              ? location.pathname.startsWith('/wiki')
              : item.href === '/rankings'
              ? (location.pathname === '/' || location.pathname.startsWith('/rankings') || location.pathname.match(/^\/[^/]+-top-100$/)) && sortParam !== 'new'
              : item.href === '/my-watchlist'
              ? location.pathname === '/my-watchlist'
              : false;
            
            return (
              <Link key={item.href} to={item.href}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`gap-2 rounded-full transition-all px-6 ${
                    isActive 
                      ? 'bg-card text-primary shadow-md font-semibold hover:bg-card hover:text-primary' 
                      : 'text-muted-foreground hover:text-muted-foreground hover:bg-transparent'
                  }`}
                >
                  {item.emoji ? (
                    <span className="text-lg">{item.emoji}</span>
                  ) : item.icon ? (
                    <item.icon className="w-5 h-5" />
                  ) : null}
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>
        
        {/* Search in Header */}
        {showSearch && (
          <div className="relative flex-1 max-w-2xl animate-fade-in">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="K Trendz..." 
              value={searchQuery} 
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-10 pr-4 h-9 text-sm rounded-full" 
            />
          </div>
        )}
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {loading ? (
            // 로딩 중에는 로그인 버튼이 깜빡이지 않도록, 아바타 셸만 표시
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full p-0.5 md:p-1 h-10 w-10 md:h-12 md:w-12"
            >
              <Avatar className="h-9 w-9 md:h-11 md:w-11">
                <AvatarFallback className="bg-muted animate-pulse" />
              </Avatar>
            </Button>
          ) : user ? (
          <>
              {/* Create Fanz Button - Admin Only */}
              {isAdmin && (
                <Button 
                  onClick={() => navigate('/wiki/create')} 
                  size="sm"
                  className="rounded-full h-10 w-10 md:w-auto px-0 md:px-3 md:gap-2 flex items-center justify-center"
                >
                  <Wand2 className="w-4 h-4" />
                  <span className="hidden md:inline-block text-sm whitespace-nowrap">
                    Create Fanz
                  </span>
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full p-0.5 md:p-1 h-10 w-10 md:h-12 md:w-12 relative">
                    <Avatar className="h-9 w-9 md:h-11 md:w-11">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={displayName} />
                      ) : hasProfile ? (
                        <AvatarFallback className="bg-primary/10">
                          {fallbackAvatar && (
                            <img src={fallbackAvatar} alt="avatar" className="w-full h-full" />
                          )}
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-muted animate-pulse" />
                      )}
                    </Avatar>
                    {unreadNotifications > 0 && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2 max-h-[70vh] md:max-h-[calc(100vh-100px)] overflow-y-auto pb-20 md:pb-4">
                  {/* Notification Icon Row */}
                  <div className="px-3 py-0.5 flex items-center justify-between">
                    <DropdownMenuItem 
                      className="h-8 gap-1 px-2 cursor-pointer"
                      onClick={() => navigate('/profile?tab=invitations')}
                    >
                      <Ticket className="w-4 h-4" />
                      <span className="text-xs text-muted-foreground">Invitation</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="relative h-8 w-8 p-0 flex items-center justify-center cursor-pointer"
                      onClick={() => navigate('/notifications')}
                    >
                      <Bell className="w-4 h-4" />
                      {unreadNotifications > 0 && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </DropdownMenuItem>
                  </div>
                  {/* User Info Row - Clickable to Profile */}
                  <div 
                    className="px-3 py-1 cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(profile?.username ? `/u/${profile.username}` : '/profile');
                    }}
                  >
                    <p className="font-semibold text-lg text-foreground flex items-center gap-1.5">
                      {displayName}
                      <BarChart3 className="w-4 h-4 text-muted-foreground/60" />
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      Level {profile?.current_level || 1} • <span className="text-muted-foreground">{profile?.total_points || 0} XP</span>
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Create Post 버튼 - 당분간 숨김 처리 (엔트리에서 직접 글쓰기로 변경됨) */}
                  {/* Stars Button */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/purchase');
                    }}
                    className="mx-1 my-1 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 cursor-pointer transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-foreground">Stars</span>
                      </div>
                      <div className="flex items-center gap-1 bg-background/50 px-3 py-1 rounded-full">
                        <span className="text-base font-bold text-foreground">{profile?.available_points || 0}</span>
                      </div>
                    </div>
                  </div>
                  {/* Lightstick Section - Enhanced */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/my-fanz');
                    }}
                    className="mx-1 my-1 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 cursor-pointer transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🪄</span>
                        <span className="font-semibold text-foreground">Lightstick</span>
                      </div>
                      <div className="flex items-center gap-1 bg-background/50 px-3 py-1 rounded-full">
                        <span className="text-base font-bold text-foreground">{totalFanzTokens}</span>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Daily Vote Energy Bar */}
                  {dailyVotes && (
                    <div className="mx-1 my-1 p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-medium text-muted-foreground">Daily Votes | Reward</span>
                      </div>
                      <div className="relative h-6 bg-muted-foreground/30 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 transition-all duration-500 ease-out animate-gradient-flow"
                          style={{
                            width: `${(dailyVotes.remaining_votes / dailyVotes.max_votes) * 100}%`,
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                          <span className="text-sm text-white">
                            {dailyVotes.remaining_votes}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/mentions');
                    }} 
                    className="py-3 text-base cursor-pointer relative"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    My Fanz
                    {unreadMentions > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/earn');
                    }} 
                    className="py-3 text-base cursor-pointer"
                  >
                    <DollarSign className="mr-2 h-5 w-5" />
                    My Earnings
                  </DropdownMenuItem>
                  {showWalletMenu && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate('/wallet');
                      }} 
                      className="py-3 text-base cursor-pointer"
                    >
                      <Wallet className="mr-2 h-5 w-5" />
                      K-Trendz Wallet
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/messages');
                    }} 
                    className="py-3 text-base cursor-pointer relative"
                  >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Messages
                    {unreadMessages > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </DropdownMenuItem>
                  {isOwner && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/owner-dashboard')} 
                      className="py-3 text-base bg-primary/10 hover:bg-primary/20"
                    >
                      <LayoutDashboard className="mr-2 h-5 w-5 text-primary" />
                      <span className="text-primary font-medium">Owner Dashboard</span>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="py-3 text-base">
                      <Shield className="mr-2 h-5 w-5" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {user?.email && (
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  )}
                  <DropdownMenuItem onClick={signOut} className="text-destructive py-3 text-base">
                    <LogOut className="mr-2 h-5 w-5" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="default" className="rounded-full text-sm h-10 px-4 md:px-5">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
