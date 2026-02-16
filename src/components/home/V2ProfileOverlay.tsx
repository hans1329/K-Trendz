import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  Zap,
  Sparkles,
  DollarSign,
  Wallet,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  Ticket,
  Shield,
  LayoutDashboard,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerStatus } from "@/hooks/useOwnerStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarThumbnail } from "@/lib/image";

interface V2ProfileOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const V2ProfileOverlay = ({ open, onOpenChange }: V2ProfileOverlayProps) => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { isOwner } = useOwnerStatus();
  const isMobile = useIsMobile();
  
  const [totalFanzTokens, setTotalFanzTokens] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [dailyVotes, setDailyVotes] = useState<{
    current_count: number;
    max_votes: number;
    remaining_votes: number;
  } | null>(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const displayName = profile?.display_name || profile?.username || "User";
  const avatarUrl = profile?.avatar_url
    ? getAvatarThumbnail(profile.avatar_url, 96) || profile.avatar_url
    : undefined;

  // Wallet 메뉴 표시 여부 설정 불러오기
  useEffect(() => {
    const fetchWalletMenuSetting = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "show_wallet_menu")
        .single();

      if (data?.setting_value) {
        setShowWalletMenu((data.setting_value as any)?.enabled || false);
      }
    };

    fetchWalletMenuSetting();
  }, []);

  // 읽지 않은 알림 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnreadNotifications(count || 0);
    };

    fetchUnreadCount();
  }, [user]);

  // 읽지 않은 메시지 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchUnreadMessages = async () => {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!conversations || conversations.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const conversationIds = conversations.map((c) => c.id);

      const { count } = await supabase
        .from("direct_messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      setUnreadMessages(count || 0);
    };

    fetchUnreadMessages();
  }, [user]);

  // Fanz Token 총 개수 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchTotalFanzTokens = async () => {
      try {
        const { data: walletRows } = await supabase
          .from("wallet_addresses")
          .select("wallet_address, wallet_type")
          .eq("user_id", user.id)
          .limit(10);

        if (!walletRows || walletRows.length === 0) {
          setTotalFanzTokens(0);
          return;
        }

        const walletAddress =
          walletRows.find((w) => w.wallet_type === "smart_wallet")?.wallet_address ||
          walletRows[0]?.wallet_address;

        if (!walletAddress) {
          setTotalFanzTokens(0);
          return;
        }

        const { data: balanceData, error: balanceError } = await supabase.functions.invoke(
          "get-user-fanz-balances",
          {
            body: {
              walletAddress,
              userId: user.id,
              includeMeta: false,
            },
          }
        );

        if (balanceError || !balanceData?.balances) {
          setTotalFanzTokens(0);
          return;
        }

        const total = (balanceData.balances as Array<{ balance: number }>).reduce(
          (sum, t) => sum + (Number(t.balance) || 0),
          0
        );

        setTotalFanzTokens(total);
      } catch (error) {
        console.error("Error fetching fanz tokens:", error);
      }
    };

    fetchTotalFanzTokens();
  }, [user]);

  // 일일 투표 상태 가져오기
  useEffect(() => {
    if (!user) return;

    const fetchDailyVoteStatus = async () => {
      try {
        const { data, error } = await supabase.rpc("get_daily_vote_status", {
          user_id_param: user.id,
        });

        if (error) throw error;

        const voteData = data as {
          current_count: number;
          max_votes: number;
          remaining_votes: number;
          can_vote: boolean;
        };
        setDailyVotes({
          current_count: voteData.current_count,
          max_votes: voteData.max_votes,
          remaining_votes: voteData.remaining_votes,
        });
      } catch (error) {
        console.error("Error fetching daily vote status:", error);
      }
    };

    fetchDailyVoteStatus();
  }, [user]);

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
  };

  if (!user) return null;

  // 공통 컨텐츠
  const profileContent = (
    <div className="flex flex-col gap-4 p-4">
      {/* User Info */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => handleNavigate(profile?.username ? `/u/${profile.username}` : "/profile")}
      >
        <Avatar className="w-14 h-14">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {displayName[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg text-foreground truncate">{displayName}</p>
          <p className="text-sm text-muted-foreground">
            Level {profile?.current_level || 1} • {profile?.total_points || 0} XP
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2"
          onClick={() => handleNavigate("/profile?tab=invitations")}
        >
          <Ticket className="w-4 h-4" />
          Invitation
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 relative"
          onClick={() => handleNavigate("/notifications")}
        >
          <Bell className="w-4 h-4" />
          Notifications
          {unreadNotifications > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Button>
      </div>

      <Separator />

      {/* Stars */}
      <div
        onClick={() => handleNavigate("/purchase")}
        className="p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 cursor-pointer transition-all hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="font-semibold">Stars</span>
          </div>
          <div className="flex items-center gap-1 bg-background/50 px-3 py-1 rounded-full">
            <span className="text-base font-bold">{profile?.available_points || 0}</span>
          </div>
        </div>
      </div>

      {/* Lightstick */}
      <div
        onClick={() => handleNavigate("/my-fanz")}
        className="p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 cursor-pointer transition-all hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪄</span>
            <span className="font-semibold">Lightstick</span>
          </div>
          <div className="flex items-center gap-1 bg-background/50 px-3 py-1 rounded-full">
            <span className="text-base font-bold">{totalFanzTokens}</span>
          </div>
        </div>
      </div>

      {/* Daily Votes */}
      {dailyVotes && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground">Daily Votes</span>
          </div>
          <div className="relative h-5 bg-muted-foreground/30 rounded-full overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 transition-all duration-500"
              style={{
                width: `${(dailyVotes.remaining_votes / dailyVotes.max_votes) * 100}%`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-end pr-2">
              <span className="text-xs font-medium text-white">{dailyVotes.remaining_votes}</span>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Menu Items */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/mentions")}
        >
          <Sparkles className="w-5 h-5" />
          My Fanz
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/earn")}
        >
          <DollarSign className="w-5 h-5" />
          My Earnings
        </Button>

        {showWalletMenu && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
            onClick={() => handleNavigate("/wallet")}
          >
            <Wallet className="w-5 h-5" />
            K-Trendz Wallet
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base relative hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/messages")}
        >
          <MessageSquare className="w-5 h-5" />
          Messages
          {unreadMessages > 0 && (
            <span className="absolute right-3 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/my-agent")}
        >
          <span className="text-lg w-5 flex items-center justify-center">🤖</span>
          My Bot Agent
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/profile")}
        >
          <Settings className="w-5 h-5" />
          Settings
        </Button>

        {isOwner && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-base bg-primary/10 hover:bg-primary/10"
            onClick={() => handleNavigate("/owner-dashboard")}
          >
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <span className="text-primary font-medium">Owner Dashboard</span>
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
          onClick={() => handleNavigate("/bot-trading")}
        >
          <Bot className="w-5 h-5" />
          Bot Trading
        </Button>

        {isAdmin && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-base hover:bg-transparent hover:text-foreground"
            onClick={() => handleNavigate("/admin")}
          >
            <Shield className="w-5 h-5" />
            Admin Panel
          </Button>
        )}
      </div>

      <Separator />

      {/* Email & Logout */}
      {user?.email && (
        <p className="text-xs text-muted-foreground px-1">{user.email}</p>
      )}

      <Button
        variant="ghost"
        className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        <LogOut className="w-5 h-5" />
        Logout
      </Button>
    </div>
  );

  // 모바일: Drawer (Bottom Sheet)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] mx-3 rounded-t-2xl">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Profile Menu</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">
            {profileContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // PC: Dialog (Modal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Profile Menu</DialogTitle>
        </DialogHeader>
        {profileContent}
      </DialogContent>
    </Dialog>
  );
};

export default V2ProfileOverlay;
