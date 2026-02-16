import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import VoteButtons from "@/components/VoteButtons";
import PostCard from "@/components/PostCard";
import CommentSection from "@/components/CommentSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Edit, History, Eye, Verified, User, Calendar, ArrowLeft, ImageOff, Trash2, Heart, Coins, Music2, ExternalLink, Newspaper, CalendarDays, Users, Image as ImageIcon, Upload, Shield, Gift, Rss, Instagram, Youtube, Twitter, ChevronDown, Share2, Crown, Trophy, Pencil, UserPlus, Lock, Key, Megaphone, MessageCircle, HelpCircle, Wand2 } from "lucide-react";
import FanCoverImageDialog from "@/components/FanCoverImageDialog";
import OwnerApplicationDialog from "@/components/OwnerApplicationDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LinkToGroupDialog from "@/components/LinkToGroupDialog";
import FanzTokenButton from "@/components/FanzTokenButton";
import FanzTokenHoldersDialog from "@/components/FanzTokenHoldersDialog";
import FanUpButton from "@/components/FanUpButton";
import MyFanStatusCard from "@/components/MyFanStatusCard";
import MentionAutocomplete from "@/components/MentionAutocomplete";
import { WikiEntryRoleManager } from "@/components/WikiEntryRoleManager";
import SignupCTA from "@/components/SignupCTA";
import { WikiBreadcrumb } from "@/components/WikiBreadcrumb";
import SupportFundCard from "@/components/SupportFundCard";
import SupportProposals from "@/components/SupportProposals";
import WikiEntryChatrooms from "@/components/WikiEntryChatrooms";
import PurchaseCelebrationDialog from "@/components/PurchaseCelebrationDialog";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePageTranslation } from "@/hooks/usePageTranslation";
import TranslationBanner from "@/components/TranslationBanner";
const timeAgo = (date: string | Date) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};

// 이미지 블러 처리 여부 체크 헬퍼 함수
const shouldBlurPostImage = (metadata: {
  image_visibility?: string;
  min_token_holdings?: number;
} | null, isFollowing: boolean, userTokenBalance: number, eventDate?: string | null, isAdmin?: boolean, isModerator?: boolean, isPageOwner?: boolean): boolean => {
  // 관리자/모더레이터/페이지 운영자는 블러 처리 우회
  if (isAdmin || isModerator || isPageOwner) return false;
  if (!metadata?.image_visibility) return false;
  if (metadata.image_visibility === 'followers' && isFollowing) return false;
  if (metadata.image_visibility === 'private') return true;
  if (metadata.image_visibility === 'followers') return !isFollowing;
  if (metadata.image_visibility === 'token_holders') {
    const minRequired = metadata.min_token_holdings || 1;
    return userTokenBalance < minRequired;
  }
  if (metadata.image_visibility === 'scheduled') {
    if (!eventDate) return true;
    const scheduledDate = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    scheduledDate.setHours(0, 0, 0, 0);
    return today < scheduledDate;
  }
  return false;
};

// 블러 이유 메시지 헬퍼 함수
const getBlurReasonText = (metadata: {
  image_visibility?: string;
  min_token_holdings?: number;
} | null, eventDate?: string | null): string => {
  if (!metadata?.image_visibility) return '';
  if (metadata.image_visibility === 'private') return 'Private';
  if (metadata.image_visibility === 'followers') return 'Fans Only';
  if (metadata.image_visibility === 'token_holders') {
    const minRequired = metadata.min_token_holdings || 1;
    return `${minRequired}+ Lightsticks holder`;
  }
  if (metadata.image_visibility === 'scheduled') {
    if (eventDate) {
      const date = new Date(eventDate);
      return `Opens ${date.toLocaleDateString()}`;
    }
    return 'Scheduled';
  }
  return '';
};
const WikiDetail = () => {
  const {
    id: slugOrId
  } = useParams<{
    id: string;
  }>();
  const {
    user,
    isAdmin,
    isModerator,
    profile
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const isMobile = useIsMobile();
  const verificationInProgress = useRef(false);
  const [imageError, setImageError] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string;
    type: string;
  } | null>(null);
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const [uploadPointCost, setUploadPointCost] = useState(0);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [fanPostsPage, setFanPostsPage] = useState(1);
  const [allFanPosts, setAllFanPosts] = useState<any[]>([]);
  const [hasMoreFanPosts, setHasMoreFanPosts] = useState(true);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Map<string, any[]>>(new Map());
  const [commentVotes, setCommentVotes] = useState<Map<string, Map<string, "up" | "down" | null>>>(new Map());
  const [minLevelRequired, setMinLevelRequired] = useState<number>(1);
  const [topContributors, setTopContributors] = useState<any[]>([]);
  const [isContributorsDialogOpen, setIsContributorsDialogOpen] = useState(false);
  const [optimisticFollowerCount, setOptimisticFollowerCount] = useState<number | null>(null);
  const [isFollowersDialogOpen, setIsFollowersDialogOpen] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [entryComments, setEntryComments] = useState<any[]>([]);
  const [entryCommentVotes, setEntryCommentVotes] = useState<Map<string, "up" | "down" | null>>(new Map());
  const [isFocused, setIsFocused] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sortBy, setSortBy] = useState<"best" | "new" | "top" | "controversial">("best");
  const [isTokenIssuing, setIsTokenIssuing] = useState(false);
  const [isOwnerApplicationOpen, setIsOwnerApplicationOpen] = useState(false);
  const [isFanCoverDialogOpen, setIsFanCoverDialogOpen] = useState(false);
  const [showCelebrationDialog, setShowCelebrationDialog] = useState(false);
  const [purchasedTokenBalance, setPurchasedTokenBalance] = useState(1);
  const [showLightstickHoldersDialog, setShowLightstickHoldersDialog] = useState(false);
  const fanPostsPerPage = 20;

  // 위키 엔트리 정보 먼저 가져오기 (slug 또는 ID로)
  const {
    data: entry,
    isLoading,
    refetch: refetchEntry
  } = useQuery({
    queryKey: ['wiki-entry', slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;

      // Try to fetch by slug first, then by ID if that fails
      let query = supabase.from('wiki_entries').select('*, last_editor:profiles!wiki_entries_last_edited_by_fkey(id, username, display_name, avatar_url), creator:profiles!wiki_entries_creator_id_fkey(id, username, display_name, avatar_url), owner:profiles!wiki_entries_owner_id_fkey(id, username, display_name, avatar_url)');

      // Check if it's a UUID (has hyphens and correct length)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      if (isUuid) {
        query = query.eq('id', slugOrId);
      } else {
        query = query.eq('slug', slugOrId);
      }
      const {
        data,
        error
      } = await query.single();
      if (error) throw error;

      // 조회수 증가 (updated_at 건드리지 않음)
      if (data) {
        await supabase.rpc('increment_wiki_entry_view_count', {
          entry_id: data.id
        });
      }

      // last_editor가 없으면 wiki_edit_history에서 가져오기, 그것도 없으면 creator 사용
      if (data && !data.last_editor) {
        const {
          data: historyData,
          error: historyError
        } = await supabase.from('wiki_edit_history').select('editor_id, profiles!wiki_edit_history_editor_id_fkey(id, username, avatar_url, display_name)').eq('wiki_entry_id', data.id).order('created_at', {
          ascending: false
        }).limit(1).maybeSingle();
        if (historyData && historyData.profiles) {
          data.last_editor = historyData.profiles;
        } else if (data.creator) {
          // 편집 기록도 없으면 creator를 last_editor로 사용
          data.last_editor = data.creator;
        }
      }

      // Reset optimistic count when new data is fetched
      setOptimisticFollowerCount(null);

      // Fetch followers immediately to show avatars
      fetchFollowers();
      return data;
    },
    enabled: !!slugOrId,
    staleTime: 0,
    // 항상 최신 데이터 가져오기
    gcTime: 1 * 60 * 1000 // 1분간 캐시 유지
  });
  const entryId = entry?.id;

  // 결제 성공/취소 처리는 FanzTokenButton.tsx에서 담당 (중복 방지)

  // URL 해시가 #comments인 경우 댓글 섹션으로 스크롤
  useEffect(() => {
    if (location.hash === '#comments' && entry) {
      setTimeout(() => {
        const commentsElement = document.getElementById('comments');
        if (commentsElement) {
          commentsElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
    }
  }, [location.hash, entry]);

  // 기본 탭을 Fund(posts)로 설정
  useEffect(() => {
    if (entry && activeSection === null) {
      setActiveSection('posts');
    }
  }, [entry, activeSection]);

  // 위키 엔트리에 받은 뱃지 가져오기
  const {
    data: receivedBadges,
    refetch: refetchBadges
  } = useQuery({
    queryKey: ['wiki-entry-badges', entryId],
    queryFn: async () => {
      if (!entryId) return {
        badges: [],
        counts: {}
      };
      const {
        data,
        error
      } = await supabase.from('wiki_entry_gift_badges').select('*, gift_badges(*), profiles(username, display_name, avatar_url)').eq('wiki_entry_id', entryId).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Count badges by type
      const counts: Record<string, number> = {};
      data?.forEach((item: any) => {
        const badgeId = item.gift_badge_id;
        counts[badgeId] = (counts[badgeId] || 0) + 1;
      });
      return {
        badges: data || [],
        counts
      };
    },
    enabled: !!entryId
  });

  // Fanz Token 정보 조회 (응원봉 발행 상태 + 다이얼로그용)
  const { data: fanzTokenData } = useQuery({
    queryKey: ['fanz-token-data', entryId],
    queryFn: async () => {
      if (!entryId) return null;
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select('id, token_id')
        .eq('wiki_entry_id', entryId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!entryId
  });
  const hasFanzToken = !!fanzTokenData;

  // 페이지 번역 (브라우저 언어 기반)
  const translationSegments = useMemo(() => {
    if (!entry) return {};
    const segs: Record<string, string> = {};
    // 타이틀, About(content)는 번역하지 않음 - 리소스 절약
    return segs;
  }, [entry]);

  const {
    isTranslating: isPageTranslating,
    isTranslated: isPageTranslated,
    isTranslatableLanguage,
    showOriginal,
    toggleOriginal,
    languageName,
    t: pageT,
  } = usePageTranslation({
    cacheKey: entryId || '',
    segments: translationSegments,
    enabled: !!entry,
  });

  // 번역 완료 시에도 About 섹션은 접어둔 상태 유지

  // creator, owner, lastEditor는 entry에서 직접 가져옴
  const creator = entry?.creator;
  const owner = entry?.owner;
  const lastEditor = entry?.last_editor;

  // 소유권 신청 상태 확인
  const {
    data: userApplication,
    refetch: refetchApplication
  } = useQuery({
    queryKey: ['owner-application', entryId, user?.id],
    queryFn: async () => {
      if (!entryId || !user?.id) return null;
      const {
        data,
        error
      } = await supabase.from('owner_applications').select('*').eq('wiki_entry_id', entryId).eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!entryId && !!user?.id
  });
  const handleDelete = async () => {
    if (!entryId) return;
    try {
      const {
        error
      } = await supabase.from('wiki_entries').delete().eq('id', entryId);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Wiki entry deleted successfully"
      });
      navigate('/rankings');
    } catch (error) {
      console.error('Error deleting wiki entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete wiki entry",
        variant: "destructive"
      });
    }
  };

  // Vote handler
  const handleVote = async (type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    if (!isFollower) {
      toast({
        title: "Fan Up Required",
        description: "You must be a fan of this artist to vote. Please fan up first!",
        variant: "destructive"
      });
      return;
    }
    if (!entryId || !entry) return;
    const oldUserVote = userVote;
    const newUserVote = oldUserVote === type ? null : type;

    // Optimistic Update: 즉시 UI 반영
    const previousVote = oldUserVote;
    const previousVotes = entry.votes;

    // 투표 수 변화 계산
    let voteDelta = 0;
    if (oldUserVote === 'up' && newUserVote === null) voteDelta = -1;
    else if (oldUserVote === 'up' && newUserVote === 'down') voteDelta = -2;
    else if (oldUserVote === 'down' && newUserVote === null) voteDelta = 1;
    else if (oldUserVote === 'down' && newUserVote === 'up') voteDelta = 2;
    else if (oldUserVote === null && newUserVote === 'up') voteDelta = 1;
    else if (oldUserVote === null && newUserVote === 'down') voteDelta = -1;

    // 즉시 캐시 업데이트 (현재 화면은 slugOrId 키를 사용)
    const todayDate = new Date().toISOString().split('T')[0];
    queryClient.setQueryData(['wiki-entry-vote', entryId, user.id, todayDate], newUserVote);
    if (slugOrId) {
      queryClient.setQueryData(['wiki-entry', slugOrId], (old: any) =>
        old ? { ...old, votes: (old.votes || 0) + voteDelta } : old
      );
    }
    // 다른 화면/참조를 위해 entryId 키도 함께 업데이트
    queryClient.setQueryData(['wiki-entry', entryId], (old: any) =>
      old ? { ...old, votes: (old.votes || 0) + voteDelta } : old
    );
    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = oldUserVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const isVoteSwitch = oldUserVote !== null && newUserVote !== null && oldUserVote !== newUserVote;
    console.log('[WikiVote] Clicked', {
      type,
      oldUserVote,
      newUserVote,
      isUnvoting,
      isVoteSwitch,
      entryId
    });

    // 새 투표만 에너지 체크 (취소나 전환은 제외)
    if (!isUnvoting && !isVoteSwitch) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const {
          data: voteCheck,
          error: checkError
        } = await supabase.rpc('check_and_increment_vote_count', {
          user_id_param: user.id,
          target_id_param: entryId,
          target_type_param: 'wiki_entry'
        });
        console.log('[WikiVote] check_and_increment_vote_count result', {
          voteCheck,
          checkError
        });
        if (checkError) throw checkError;
        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as {
          can_vote: boolean;
          max_votes: number;
          remaining_votes: number;
          current_level: number;
          completion_rewarded?: boolean;
          is_first_vote_today: boolean;
        };
        console.log('[WikiVote] Parsed checkData', checkData);
        
        // 오늘 이미 같은 엔트리에 투표한 경우
        if (!checkData?.is_first_vote_today) {
          console.log('[WikiVote] Already voted on this entry today');
          // Rollback optimistic update
          queryClient.setQueryData(['wiki-entry-vote', entryId, user.id, todayDate], previousVote);
          if (slugOrId) {
            queryClient.setQueryData(['wiki-entry', slugOrId], (old: any) =>
              old ? { ...old, votes: previousVotes } : old
            );
          }
          queryClient.setQueryData(['wiki-entry', entryId], (old: any) =>
            old ? { ...old, votes: previousVotes } : old
          );
          toast({
            title: "Already voted today",
            description: "You can only vote once per entry per day. Come back tomorrow!",
            variant: "destructive"
          });
          return;
        }
        
        // 일일 에너지 한도 초과
        if (!checkData.can_vote) {
          console.log('[WikiVote] Daily limit reached, blocking vote');
          // Rollback optimistic update
          queryClient.setQueryData(['wiki-entry-vote', entryId, user.id, todayDate], previousVote);
          if (slugOrId) {
            queryClient.setQueryData(['wiki-entry', slugOrId], (old: any) =>
              old ? { ...old, votes: previousVotes } : old
            );
          }
          queryClient.setQueryData(['wiki-entry', entryId], (old: any) =>
            old ? { ...old, votes: previousVotes } : old
          );
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive"
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          console.log('[WikiVote] Daily energy completed, triggering bonus + token flow');
          toast({
            title: "🎉 Daily Energy Completed!",
            description: `Bonus points awarded for using all ${checkData.max_votes} energy today!`
          });

          // 토큰 민팅 시작 알림 - 즉시 표시
          console.log('[WikiVote] Showing Reward Token Minting toast');
          toast({
            title: "Reward Token Minting...",
            description: "Processing your daily KTNZ token reward"
          });

          // 데일리 토큰 민팅 (1.5초 후 시작)
          setTimeout(async () => {
            try {
              console.log('[WikiVote] Calling mint-daily-tokens edge function');
              const {
                data: mintData,
                error: mintError
              } = await supabase.functions.invoke('mint-daily-tokens');
              console.log('[WikiVote] mint-daily-tokens result', {
                mintData,
                mintError
              });
              if (mintError) {
                console.error('Token mint error:', mintError);
                const errorData = mintError as any;
                if (errorData.needsWallet || errorData.message?.includes('wallet')) {
                  toast({
                    title: "Wallet Required",
                    description: "Please create a wallet first to claim daily tokens",
                    action: <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
                        Create Wallet
                      </Button>
                  });
                }
              } else if (mintData?.success) {
                toast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`
                });
              }
            } catch (error) {
              console.error('Failed to mint daily tokens:', error);
            }
          }, 1500);
        } else {
          toast({
            title: "Vote counted",
            description: `Energy ${checkData.max_votes - checkData.remaining_votes}/${checkData.max_votes} used today. You can vote again tomorrow!`
          });
        }

        // Navbar 업데이트 트리거
        window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
      } catch (error) {
        console.error("Error checking vote count:", error);
        toast({
          title: "Vote check failed",
          description: "Failed to check daily vote limit",
          variant: "destructive"
        });
        return;
      }
    }
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Wiki entry 투표 처리
      if (newUserVote === null) {
        // Delete vote (오늘 날짜 기준)
        const {
          error
        } = await supabase.from('wiki_entry_votes').delete().eq('wiki_entry_id', entryId).eq('user_id', user.id).eq('vote_date', today);
        if (error) throw error;
      } else if (oldUserVote === null) {
        // Insert new vote with vote_date
        const {
          error
        } = await supabase.from('wiki_entry_votes').insert({
          wiki_entry_id: entryId,
          user_id: user.id,
          vote_type: newUserVote,
          vote_date: today
        });
        if (error) throw error;
      } else {
        // Update existing vote (오늘 날짜 기준)
        const {
          error
        } = await supabase.from('wiki_entry_votes').update({
          vote_type: newUserVote
        }).eq('wiki_entry_id', entryId).eq('user_id', user.id).eq('vote_date', today);
        if (error) throw error;
      }

      // 연결된 post가 있는 경우 post 투표도 함께 처리
      const {
        data: connectedPost
      } = await supabase.from('posts').select('id').eq('wiki_entry_id', entryId).maybeSingle();
      if (connectedPost) {
        if (newUserVote === null) {
          // Post 투표 삭제
          await supabase.from('post_votes').delete().eq('post_id', connectedPost.id).eq('user_id', user.id);
        } else if (oldUserVote === null) {
          // 새 post 투표 생성
          await supabase.from('post_votes').insert({
            post_id: connectedPost.id,
            user_id: user.id,
            vote_type: newUserVote
          });
        } else {
          // Post 투표 변경
          await supabase.from('post_votes').update({
            vote_type: newUserVote
          }).eq('post_id', connectedPost.id).eq('user_id', user.id);
        }
      }

      // 온체인 투표 기록 (upvote인 경우만, 관리자 제외)
      if (newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin) {
        try {
          const { data: onchainResult } = await supabase.functions.invoke('record-onchain-vote', {
            body: {
              eventId: null,
              // wiki entry 투표는 eventId 없음
              oderId: null,
              voterAddressOrUserId: user.id,
              artistName: entry.title,
              inviteCode: '',
              voteCount: 1
            }
          });
          console.log('[WikiDetail] On-chain vote recorded for entry:', entry.title, onchainResult);
          
          // tx_hash를 wiki_entry_votes에 저장
          if (onchainResult?.txHash) {
            await supabase
              .from('wiki_entry_votes')
              .update({ tx_hash: onchainResult.txHash })
              .eq('wiki_entry_id', entryId)
              .eq('user_id', user.id)
              .eq('vote_date', today);
          }
        } catch (onchainError) {
          console.error('[WikiDetail] On-chain vote recording failed:', onchainError);
          // 온체인 기록 실패해도 투표 자체는 성공
        }
      }

      // Refetch to update UI
      await Promise.all([refetchEntry(), refetchUserVote()]);

      // Navbar에 투표 상태 업데이트 알림
      window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
    } catch (error: any) {
      console.error('Error voting:', error);
      // Rollback optimistic update on error
      queryClient.setQueryData(['wiki-entry-vote', entryId, user.id, todayDate], previousVote);
      if (slugOrId) {
        queryClient.setQueryData(['wiki-entry', slugOrId], (old: any) =>
          old ? { ...old, votes: previousVotes } : old
        );
      }
      queryClient.setQueryData(['wiki-entry', entryId], (old: any) =>
        old ? { ...old, votes: previousVotes } : old
      );
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };
  // Fetch followers
  const fetchFollowers = async () => {
    if (!entryId) return;
    setLoadingFollowers(true);
    try {
      const {
        data,
        error
      } = await supabase.from('wiki_entry_followers').select(`
          user_id,
          created_at,
          profiles!wiki_entry_followers_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `).eq('wiki_entry_id', entryId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setFollowers(data || []);
    } catch (error) {
      console.error('Error fetching followers:', error);
      toast({
        title: "Error",
        description: "Failed to load followers",
        variant: "destructive"
      });
    } finally {
      setLoadingFollowers(false);
    }
  };

  // Fetch wiki entry comments
  const fetchEntryComments = async () => {
    if (!entryId) return;
    try {
      const {
        data: commentsData,
        error
      } = await supabase.from("comments").select("*").eq("wiki_entry_id", entryId).is("post_id", null).order("created_at", {
        ascending: true
      });
      if (error) throw error;

      // 프로필 정보 가져오기
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const {
          data: profilesData
        } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const enrichedComments = commentsData.map(comment => ({
          ...comment,
          profiles: profilesMap.get(comment.user_id) || null
        }));

        // 사용자의 댓글 투표 정보 가져오기
        if (user) {
          const commentIds = commentsData.map(c => c.id);
          const {
            data: voteData
          } = await supabase.from('comment_votes').select('comment_id, vote_type').in('comment_id', commentIds).eq('user_id', user.id);
          const votesMap = new Map<string, "up" | "down" | null>();
          voteData?.forEach(vote => {
            votesMap.set(vote.comment_id, vote.vote_type);
          });
          setEntryCommentVotes(votesMap);
        }

        // 댓글을 트리 구조로 변환
        const commentsMap = new Map<string, any>();
        const topLevelComments: any[] = [];
        enrichedComments.forEach(comment => {
          commentsMap.set(comment.id, {
            ...comment,
            replies: []
          });
        });
        enrichedComments.forEach(comment => {
          if (comment.parent_comment_id) {
            const parent = commentsMap.get(comment.parent_comment_id);
            if (parent) {
              parent.replies.push(commentsMap.get(comment.id));
            }
          } else {
            topLevelComments.push(commentsMap.get(comment.id));
          }
        });
        setEntryComments(topLevelComments);
      } else {
        setEntryComments([]);
      }
    } catch (error) {
      console.error("Error fetching entry comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive"
      });
    }
  };

  // Entry comment handlers
  const handleAddEntryComment = async (content: string, parentCommentId?: string) => {
    if (!user || !entryId) {
      toast({
        title: "Login required",
        description: "Please login to comment",
        variant: "destructive"
      });
      return;
    }

    // 팬 체크 (관리자는 제외)
    if (!isFollower && !isAdmin) {
      toast({
        title: "Fan Up Required",
        description: "You must be a fan of this entry to comment. Please fan up first!",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from("comments").insert({
        wiki_entry_id: entryId,
        post_id: null,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId || null
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Comment added successfully"
      });
      await fetchEntryComments();
    } catch (error: any) {
      console.error("Error adding comment:", error);
      const isInsufficientPoints = error?.message?.includes('Insufficient points');
      toast({
        title: isInsufficientPoints ? "Insufficient Stars" : "Error",
        description: isInsufficientPoints ? "You don't have enough Stars to write a comment" : "Failed to add comment",
        variant: "destructive"
      });
    }
  };
  const handleVoteEntryComment = async (commentId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.rpc('handle_comment_vote', {
        comment_id_param: commentId,
        user_id_param: user.id,
        vote_type_param: type
      });
      if (error) throw error;
      await fetchEntryComments();
    } catch (error) {
      console.error("Error voting comment:", error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };
  const handleDeleteEntryComment = async (commentId: string) => {
    if (!user || !entryId) return;
    try {
      const {
        error
      } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Comment deleted successfully"
      });
      await fetchEntryComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  // Fetch entry comments when entry loads
  useEffect(() => {
    if (entryId) {
      fetchEntryComments();
    }
  }, [entryId, user]);

  // Fan Posts 투표 핸들러
  const handleFanPostVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }

    const post = fanPosts?.find((p: any) => p.id === postId);
    if (!post) return;

    const oldUserVote = (post.userVote ?? null) as "up" | "down" | null;

    // 같은 투표 클릭 시 취소
    const isUnvoting = oldUserVote === type;
    const previewNewVote: "up" | "down" | null = isUnvoting ? null : type;

    // 투표 전환(up→down/down→up)은 에너지 소모 없음
    const isVoteSwitch = oldUserVote !== null && previewNewVote !== null && oldUserVote !== previewNewVote;

    let newUserVote: "up" | "down" | null = previewNewVote;

    try {
      // 에너지 체크 (새 투표만; 취소/전환은 제외)
      if (!isUnvoting && !isVoteSwitch) {
        const { data: voteCheck, error: checkError } = await supabase.rpc(
          'check_and_increment_vote_count',
          {
            user_id_param: user.id,
            target_id_param: postId,
            target_type_param: 'post'
          }
        );

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as {
          can_vote: boolean;
          max_votes: number;
          remaining_votes: number;
          current_level: number;
          completion_rewarded?: boolean;
          is_first_vote_today: boolean;
        };

        // 오늘 이미 같은 포스트에 투표한 경우
        if (!checkData?.is_first_vote_today) {
          toast({
            title: "Already voted today",
            description: "You can only vote once per post per day. Come back tomorrow!",
            variant: "destructive"
          });
          return;
        }

        // 일일 에너지 한도 초과
        if (!checkData.can_vote) {
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive"
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          toast({
            title: "🎉 Daily Energy Completed!",
            description: `Bonus points awarded for using all ${checkData.max_votes} energy today!`
          });

          // 토큰 민팅 시작 알림
          toast({
            title: "Reward Token Minting...",
            description: "Processing your daily KTNZ token reward"
          });

          setTimeout(async () => {
            try {
              const { data: mintData, error: mintError } = await supabase.functions.invoke('mint-daily-tokens');
              if (mintError) {
                console.error('Token mint error:', mintError);
                const errorData = mintError as any;
                if (errorData.needsWallet || errorData.message?.includes('wallet')) {
                  toast({
                    title: "Wallet Required",
                    description: "Please create a wallet first to claim daily tokens",
                    action: (
                      <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
                        Create Wallet
                      </Button>
                    )
                  });
                }
              } else if (mintData?.success) {
                toast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`
                });
              }
            } catch (e) {
              console.error('Failed to mint daily tokens:', e);
            }
          }, 1500);
        }
      }

      if (newUserVote === oldUserVote) {
        // 같은 투표 클릭 시 취소
        newUserVote = null;
        const { error } = await supabase
          .from('post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표
        const { error } = await supabase.from('post_votes').insert({
          post_id: postId,
          user_id: user.id,
          vote_type: newUserVote
        });
        if (error) throw error;
      } else {
        // 투표 변경
        const { error } = await supabase
          .from('post_votes')
          .update({ vote_type: newUserVote })
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      // 온체인 투표 기록 (upvote인 경우만, 관리자 제외)
      if (newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin) {
        try {
          const postTitle = post.title || 'Fan Post';
          const { data: onchainResult } = await supabase.functions.invoke('record-onchain-vote', {
            body: {
              eventId: null,
              oderId: null,
              voterAddressOrUserId: user.id,
              artistName: postTitle,
              inviteCode: '',
              voteCount: 1
            }
          });
          console.log('[WikiDetail] On-chain vote recorded for post:', postTitle, onchainResult);

          // tx_hash를 post_votes에 저장
          if (onchainResult?.txHash) {
            await supabase
              .from('post_votes')
              .update({ tx_hash: onchainResult.txHash })
              .eq('post_id', postId)
              .eq('user_id', user.id);
          }
        } catch (onchainError) {
          console.error('[WikiDetail] On-chain vote recording failed:', onchainError);
        }
      }

      // Refetch to update UI
      await refetchFanPosts();

      // Navbar 에너지 표시 갱신
      window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };

  // 댓글 버튼 클릭 핸들러
  const handleCommentClick = async (postId: string) => {
    const isExpanding = expandedPostId !== postId;
    setExpandedPostId(expandedPostId === postId ? null : postId);

    // 확장할 때만 댓글 데이터 가져오기
    if (isExpanding && !postComments.has(postId)) {
      await fetchCommentsForPost(postId);
    }
  };

  // 특정 포스트의 댓글 가져오기
  const fetchCommentsForPost = async (postId: string) => {
    try {
      const {
        data: commentsData,
        error
      } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", {
        ascending: true
      });
      if (error) throw error;

      // 프로필 정보 가져오기
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const {
          data: profilesData
        } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const enrichedComments = commentsData.map(comment => ({
          ...comment,
          profiles: profilesMap.get(comment.user_id) || null
        }));

        // 사용자의 댓글 투표 정보 가져오기
        if (user) {
          const commentIds = commentsData.map(c => c.id);
          const {
            data: voteData
          } = await supabase.from('comment_votes').select('comment_id, vote_type').in('comment_id', commentIds).eq('user_id', user.id);
          const votesMap = new Map<string, "up" | "down" | null>();
          voteData?.forEach(vote => {
            votesMap.set(vote.comment_id, vote.vote_type);
          });
          setCommentVotes(prev => {
            const newMap = new Map(prev);
            newMap.set(postId, votesMap);
            return newMap;
          });
        }

        // 댓글을 트리 구조로 변환
        const commentsMap = new Map<string, any>();
        const topLevelComments: any[] = [];
        enrichedComments.forEach(comment => {
          commentsMap.set(comment.id, {
            ...comment,
            replies: []
          });
        });
        enrichedComments.forEach(comment => {
          const commentWithReplies = commentsMap.get(comment.id)!;
          if (comment.parent_comment_id) {
            const parent = commentsMap.get(comment.parent_comment_id);
            if (parent) {
              parent.replies!.push(commentWithReplies);
            }
          } else {
            topLevelComments.push(commentWithReplies);
          }
        });
        setPostComments(prev => {
          const newMap = new Map(prev);
          newMap.set(postId, topLevelComments);
          return newMap;
        });
      } else {
        setPostComments(prev => {
          const newMap = new Map(prev);
          newMap.set(postId, []);
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive"
      });
    }
  };

  // 댓글 추가 핸들러
  const handleAddComment = async (postId: string, content: string, parentCommentId?: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to comment",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId || null
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Comment added successfully"
      });

      // 해당 포스트의 댓글 목록 다시 불러오기
      await fetchCommentsForPost(postId);
    } catch (error: any) {
      console.error("Error adding comment:", error);
      const isInsufficientPoints = error?.message?.includes('Insufficient points');
      toast({
        title: isInsufficientPoints ? "Insufficient Stars" : "Error",
        description: isInsufficientPoints ? "You don't have enough Stars to write a comment" : "Failed to add comment",
        variant: "destructive"
      });
    }
  };

  // 댓글 삭제 핸들러
  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const {
        error
      } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Comment deleted successfully"
      });

      // 해당 포스트의 댓글 목록 다시 불러오기
      await fetchCommentsForPost(postId);
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  // 댓글 투표 핸들러
  const handleVoteComment = async (postId: string, commentId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.rpc('handle_comment_vote', {
        comment_id_param: commentId,
        user_id_param: user.id,
        vote_type_param: type
      });
      if (error) throw error;

      // 해당 포스트의 댓글 목록 다시 불러오기
      await fetchCommentsForPost(postId);
    } catch (error) {
      console.error("Error voting comment:", error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };

  // Related Tag Posts 투표 핸들러
  const handleRelatedTagPostVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }

    const post = relatedTagPosts?.find((p: any) => p.id === postId);
    if (!post) return;

    const oldUserVote = (post.userVote ?? null) as "up" | "down" | null;

    // 같은 투표 클릭 시 취소
    const isUnvoting = oldUserVote === type;
    const previewNewVote: "up" | "down" | null = isUnvoting ? null : type;

    // 투표 전환(up→down/down→up)은 에너지 소모 없음
    const isVoteSwitch = oldUserVote !== null && previewNewVote !== null && oldUserVote !== previewNewVote;

    let newUserVote: "up" | "down" | null = previewNewVote;

    try {
      // 에너지 체크 (새 투표만; 취소/전환은 제외)
      if (!isUnvoting && !isVoteSwitch) {
        const { data: voteCheck, error: checkError } = await supabase.rpc(
          'check_and_increment_vote_count',
          {
            user_id_param: user.id,
            target_id_param: postId,
            target_type_param: 'post'
          }
        );

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as {
          can_vote: boolean;
          max_votes: number;
          remaining_votes: number;
          current_level: number;
          completion_rewarded?: boolean;
          is_first_vote_today: boolean;
        };

        // 오늘 이미 같은 포스트에 투표한 경우
        if (!checkData?.is_first_vote_today) {
          toast({
            title: "Already voted today",
            description: "You can only vote once per post per day. Come back tomorrow!",
            variant: "destructive"
          });
          return;
        }

        // 일일 에너지 한도 초과
        if (!checkData.can_vote) {
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive"
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          toast({
            title: "🎉 Daily Energy Completed!",
            description: `Bonus points awarded for using all ${checkData.max_votes} energy today!`
          });

          toast({
            title: "Reward Token Minting...",
            description: "Processing your daily KTNZ token reward"
          });

          setTimeout(async () => {
            try {
              const { data: mintData, error: mintError } = await supabase.functions.invoke('mint-daily-tokens');
              if (mintError) {
                console.error('Token mint error:', mintError);
                const errorData = mintError as any;
                if (errorData.needsWallet || errorData.message?.includes('wallet')) {
                  toast({
                    title: "Wallet Required",
                    description: "Please create a wallet first to claim daily tokens",
                    action: (
                      <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
                        Create Wallet
                      </Button>
                    )
                  });
                }
              } else if (mintData?.success) {
                toast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`
                });
              }
            } catch (e) {
              console.error('Failed to mint daily tokens:', e);
            }
          }, 1500);
        }
      }

      if (newUserVote === oldUserVote) {
        // 같은 투표 클릭 시 취소
        newUserVote = null;
        const { error } = await supabase
          .from('post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표
        const { error } = await supabase.from('post_votes').insert({
          post_id: postId,
          user_id: user.id,
          vote_type: newUserVote
        });
        if (error) throw error;
      } else {
        // 투표 변경
        const { error } = await supabase
          .from('post_votes')
          .update({ vote_type: newUserVote })
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      // 온체인 투표 기록 (upvote인 경우만, 관리자 제외)
      if (newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin) {
        try {
          const postTitle = post.title || 'Related Post';
          const { data: onchainResult } = await supabase.functions.invoke('record-onchain-vote', {
            body: {
              eventId: null,
              oderId: null,
              voterAddressOrUserId: user.id,
              artistName: postTitle,
              inviteCode: '',
              voteCount: 1
            }
          });
          console.log('[WikiDetail] On-chain vote recorded for related post:', postTitle, onchainResult);

          // tx_hash를 post_votes에 저장
          if (onchainResult?.txHash) {
            await supabase
              .from('post_votes')
              .update({ tx_hash: onchainResult.txHash })
              .eq('post_id', postId)
              .eq('user_id', user.id);
          }
        } catch (onchainError) {
          console.error('[WikiDetail] On-chain vote recording failed:', onchainError);
        }
      }

      // Refetch to update UI
      await refetchRelatedTagPosts();

      // Navbar 에너지 표시 갱신
      window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };

  // Official posts fetch (posts by owner/admin for this wiki entry)
  const {
    data: relatedPosts,
    refetch: refetchOfficialPosts
  } = useQuery({
    queryKey: ['official-posts', entryId, entry?.owner_id],
    queryFn: async () => {
      if (!entryId) return [];

      // owner_id가 있으면 owner가 작성한 포스트만, 없으면 빈 배열
      if (!entry?.owner_id) return [];
      const {
        data,
        error
      } = await supabase.from('posts').select('id, title, content, image_url, created_at, votes, user_id, metadata, event_date, profiles(username, display_name, avatar_url)').eq('wiki_entry_id', entryId).eq('user_id', entry.owner_id).or('category.is.null,category.neq.announcement').order('created_at', {
        ascending: false
      }).limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry?.owner_id
  });

  // HTML 엔티티 디코딩 함수
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  };

  // Check if user is a follower
  const {
    data: isFollower,
    refetch: refetchIsFollower,
    isLoading: isFollowerLoading
  } = useQuery({
    queryKey: ['is-follower', entryId, user?.id],
    queryFn: async () => {
      if (!entryId || !user?.id) {
        console.log('isFollower check: missing entryId or user.id', {
          entryId,
          userId: user?.id
        });
        return false;
      }
      console.log('Checking follower status for:', {
        entryId,
        userId: user.id
      });
      const {
        data,
        error
      } = await supabase.from('wiki_entry_followers').select('id').eq('wiki_entry_id', entryId).eq('user_id', user.id).maybeSingle();
      if (error) {
        console.error('Error checking follower status:', error);
        throw error;
      }
      console.log('Follower check result:', {
        data,
        isFollower: !!data
      });
      return !!data;
    },
    enabled: !!entryId && !!user?.id
  });

  // 사용자의 Fanz Token 잔액 조회
  const {
    data: userTokenBalance = 0
  } = useQuery({
    queryKey: ['user-token-balance', entryId, user?.id],
    queryFn: async () => {
      if (!entryId || !user?.id) return 0;

      // 먼저 해당 entry의 fanz_token 찾기
      const {
        data: fanzToken,
        error: tokenError
      } = await supabase.from('fanz_tokens').select('id').eq('wiki_entry_id', entryId).maybeSingle();
      if (tokenError || !fanzToken) return 0;

      // 사용자의 잔액 조회
      const {
        data: balance,
        error: balanceError
      } = await supabase.from('fanz_balances').select('balance').eq('fanz_token_id', fanzToken.id).eq('user_id', user.id).maybeSingle();
      if (balanceError) return 0;
      return balance?.balance || 0;
    },
    enabled: !!entryId && !!user?.id
  });
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const {
    data: userVote,
    refetch: refetchUserVote
  } = useQuery({
    queryKey: ['wiki-entry-vote', entryId, user?.id, today],
    queryFn: async () => {
      if (!entryId || !user?.id) return null;
      const {
        data,
        error
      } = await supabase.from('wiki_entry_votes').select('vote_type').eq('wiki_entry_id', entryId).eq('user_id', user.id).eq('vote_date', today).maybeSingle();
      if (error) throw error;
      return data?.vote_type || null;
    },
    enabled: !!entryId && !!user?.id
  });

  // 사용자가 entry agent인지 확인
  const {
    data: isEntryAgent
  } = useQuery({
    queryKey: ['is-entry-agent', entryId, user?.id],
    queryFn: async () => {
      if (!entryId || !user?.id) return false;
      const {
        data,
        error
      } = await supabase.from('wiki_entry_roles').select('id').eq('wiki_entry_id', entryId).eq('user_id', user.id).eq('role', 'entry_agent').maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!entryId && !!user?.id
  });

  // 최소 레벨 설정 가져오기
  const {
    data: minLevelSetting
  } = useQuery({
    queryKey: ['wiki-min-level'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'wiki_creation_min_level').maybeSingle();
      if (error) throw error;
      return (data?.setting_value as any)?.min_level || 1;
    }
  });

  // minLevelRequired 업데이트
  useEffect(() => {
    if (minLevelSetting !== undefined) {
      setMinLevelRequired(minLevelSetting);
    }
  }, [minLevelSetting]);

  // Fan posts 총 개수 가져오기
  const {
    data: fanPostsCount
  } = useQuery({
    queryKey: ['fan-posts-count', entryId],
    queryFn: async () => {
      if (!entryId) return 0;
      const {
        count,
        error
      } = await supabase.from('posts').select('*', {
        count: 'exact',
        head: true
      }).eq('wiki_entry_id', entryId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!entryId
  });

  // 현재 엔트리와 하위 엔트리의 포스트에서 사용된 태그 가져오기
  const {
    data: entryRelatedTags
  } = useQuery({
    queryKey: ['entry-related-tags', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      try {
        // 1. 현재 엔트리의 하위 엔트리 ID 가져오기
        const {
          data: childEntries
        } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', entryId);
        const entryIds = [entryId, ...(childEntries?.map(e => e.child_entry_id) || [])];
        console.log('Checking tags for entry IDs:', entryIds);

        // 2. 해당 엔트리들과 관련된 포스트 ID 가져오기
        const {
          data: posts,
          error: postsError
        } = await supabase.from('posts').select('id').in('wiki_entry_id', entryIds);
        if (postsError) {
          console.error('Error fetching posts:', postsError);
          return [];
        }
        const postIds = posts?.map(p => p.id) || [];
        console.log('Found posts:', postIds.length);
        if (postIds.length === 0) return [];

        // 3. 포스트의 태그 가져오기
        const {
          data: postTags,
          error: tagsError
        } = await supabase.from('post_tags').select('tag_id, wiki_tags!inner(id, name, slug)').in('post_id', postIds);
        if (tagsError) {
          console.error('Error fetching post tags:', tagsError);
          return [];
        }
        console.log('Raw post tags:', postTags);

        // 4. 중복 제거
        const uniqueTags = new Map();
        postTags?.forEach((pt: any) => {
          if (pt.wiki_tags && !uniqueTags.has(pt.tag_id)) {
            uniqueTags.set(pt.tag_id, pt.wiki_tags);
          }
        });
        const result = Array.from(uniqueTags.values());
        console.log('Unique tags:', result);
        return result;
      } catch (error) {
        console.error('Error in entryRelatedTags query:', error);
        return [];
      }
    },
    enabled: !!entryId
  });

  // Top contributors fetch
  const {
    data: contributorsData
  } = useQuery({
    queryKey: ['wiki-contributors', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entry_user_contributions').select(`
          contribution_score,
          posts_count,
          comments_count,
          votes_received,
          user_id,
          profiles (
            id,
            username,
            display_name,
            avatar_url
          )
        `).eq('wiki_entry_id', entryId).order('contribution_score', {
        ascending: false
      }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId
  });

  // Update topContributors state
  useEffect(() => {
    if (contributorsData) {
      setTopContributors(contributorsData);
    }
  }, [contributorsData]);

  // Announcement posts fetch (공지사항) - 최신 1개만 표시
  const {
    data: announcements
  } = useQuery({
    queryKey: ['announcements', entryId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('posts').select('id, title, content, created_at').eq('wiki_entry_id', entryId).eq('category', 'announcement').order('created_at', {
        ascending: false
      }).limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId,
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  // Fan posts fetch (posts by followers in this wiki entry, excluding announcements)
  const {
    data: fanPosts,
    isLoading: isLoadingFanPosts,
    error: fanPostsError,
    refetch: refetchFanPosts,
    isFetching: isFetchingFanPosts
  } = useQuery({
    queryKey: ['fanPosts', entryId, fanPostsPage],
    queryFn: async () => {
      const from = (fanPostsPage - 1) * fanPostsPerPage;
      const to = from + fanPostsPerPage - 1;
      const {
        data,
        error
      } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').eq('wiki_entry_id', entryId).or('category.is.null,category.neq.announcement').order('created_at', {
        ascending: false
      }).range(from, to);
      if (error) throw error;

      // 사용자의 투표 정보 가져오기
      let userVotes: any[] = [];
      if (user && data && data.length > 0) {
        const postIds = data.map(p => p.id);
        const {
          data: votesData
        } = await supabase.from('post_votes').select('post_id, vote_type').eq('user_id', user.id).in('post_id', postIds);
        userVotes = votesData || [];
      }

      // posts에 userVote 추가
      const postsWithVotes = (data || []).map(post => {
        const userVote = userVotes.find(v => v.post_id === post.id);
        return {
          ...post,
          userVote: userVote?.vote_type || null
        };
      });
      console.log('Fan posts loaded:', postsWithVotes);
      return postsWithVotes;
    },
    enabled: !!entryId
  });

  // allFanPosts 관리 및 hasMore 업데이트
  useEffect(() => {
    console.log('Fan posts effect triggered:', {
      fanPosts,
      fanPostsPage
    });
    if (fanPosts) {
      // 빈 배열이면 더 이상 로드할 데이터 없음
      if (fanPosts.length === 0) {
        setHasMoreFanPosts(false);
        return;
      }

      // 페이지 크기보다 적게 받았으면 마지막 페이지
      if (fanPosts.length < fanPostsPerPage) {
        setHasMoreFanPosts(false);
      }
      if (fanPostsPage === 1) {
        // 첫 페이지면 교체
        setAllFanPosts(fanPosts);
      } else {
        // 다음 페이지면 추가
        setAllFanPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = fanPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    }
  }, [fanPosts, fanPostsPage]);

  // 태그로 필터링 (태그 선택 시에만 작동)
  const displayedFanPosts = useMemo(() => {
    if (!selectedTagFilter) return allFanPosts;

    // 현재 엔트리와 하위 엔트리의 포스트 ID 목록 가져오기
    const relevantPostIds = new Set(entryRelatedTags?.filter((tag: any) => tag.id === selectedTagFilter).flatMap((tag: any) => tag.post_ids || []) || []);
    return allFanPosts.filter(post => relevantPostIds.has(post.id));
  }, [allFanPosts, selectedTagFilter, entryRelatedTags]);

  // 무한 스크롤을 위한 Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreFanPosts && !isFetchingFanPosts) {
        setFanPostsPage(prev => prev + 1);
      }
    }, {
      threshold: 0.1
    });
    const sentinel = document.getElementById('fan-posts-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }
    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [hasMoreFanPosts, isFetchingFanPosts]);

  // Wiki entry의 태그 가져오기
  const {
    data: wikiTags
  } = useQuery({
    queryKey: ['wiki-entry-tags', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entry_tags').select('tag_id, wiki_tags(id, name)').eq('wiki_entry_id', entryId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId
  });

  // 관련 태그 포스트 가져오기
  const {
    data: relatedTagPosts,
    refetch: refetchRelatedTagPosts
  } = useQuery({
    queryKey: ['related-tag-posts', entryId, user?.id, wikiTags],
    queryFn: async () => {
      if (!entryId || !wikiTags || wikiTags.length === 0) return [];
      const tagIds = wikiTags.map((t: any) => t.tag_id);

      // 태그와 연결된 포스트 ID 가져오기
      const {
        data: postTags,
        error: postTagsError
      } = await supabase.from('post_tags').select('post_id').in('tag_id', tagIds);
      if (postTagsError) throw postTagsError;
      if (!postTags || postTags.length === 0) return [];
      const postIds = [...new Set(postTags.map(pt => pt.post_id))];

      // 포스트 정보 가져오기 (현재 wiki entry에 연결된 포스트 제외)
      const {
        data,
        error
      } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').in('id', postIds).neq('wiki_entry_id', entryId).order('created_at', {
        ascending: false
      }).limit(10);
      if (error) throw error;

      // 사용자의 투표 정보 가져오기
      let userVotes: any[] = [];
      if (user && data && data.length > 0) {
        const {
          data: votesData
        } = await supabase.from('post_votes').select('post_id, vote_type').eq('user_id', user.id).in('post_id', data.map(p => p.id));
        userVotes = votesData || [];
      }

      // posts에 userVote 추가
      return (data || []).map(post => {
        const userVote = userVotes.find(v => v.post_id === post.id);
        return {
          ...post,
          userVote: userVote ? userVote.vote_type : null
        };
      });
    },
    enabled: !!entryId && !!wikiTags && wikiTags.length > 0
  });

  // Related wikis fetch (same tags or same schema_type)
  const {
    data: relatedWikis
  } = useQuery({
    queryKey: ['related-wikis', entryId, entry?.schema_type],
    queryFn: async () => {
      if (!entryId) return [];

      // 현재 위키의 태그 가져오기
      const {
        data: currentTags
      } = await supabase.from('wiki_entry_tags').select('tag_id').eq('wiki_entry_id', entryId);
      let relatedIds: string[] = [];
      if (currentTags && currentTags.length > 0) {
        // 같은 태그를 가진 위키 찾기
        const tagIds = currentTags.map(t => t.tag_id);
        const {
          data: sameTagWikis
        } = await supabase.from('wiki_entry_tags').select('wiki_entry_id').in('tag_id', tagIds).neq('wiki_entry_id', entryId);
        if (sameTagWikis) {
          relatedIds = [...new Set(sameTagWikis.map(w => w.wiki_entry_id))];
        }
      }

      // 같은 타입의 위키도 추가 (태그 기반 추천이 부족할 경우)
      let query = supabase.from('wiki_entries').select('id, title, slug, image_url, schema_type, view_count, follower_count, is_verified').neq('id', entryId);
      if (relatedIds.length > 0) {
        query = query.in('id', relatedIds);
      } else if (entry?.schema_type) {
        query = query.eq('schema_type', entry.schema_type);
      }
      const {
        data,
        error
      } = await query.order('view_count', {
        ascending: false
      }).limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry
  });

  // Upcoming events fetch
  const {
    data: upcomingEvents
  } = useQuery({
    queryKey: ['upcoming-events', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('calendar_events').select('*').eq('wiki_entry_id', entryId).gte('event_date', new Date().toISOString().split('T')[0]).order('event_date', {
        ascending: true
      }).limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId
  });

  // Gallery items fetch - 포스트 content 내의 이미지만 가져오기
  const {
    data: galleryItems,
    refetch: refetchGallery
  } = useQuery({
    queryKey: ['gallery-items', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      try {
        // 1. 하위 엔트리 ID 가져오기
        const {
          data: childEntries
        } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', entryId);

        // 현재 엔트리와 모든 하위 엔트리 ID
        const allEntryIds = [entryId, ...(childEntries?.map(e => e.child_entry_id) || [])];
        console.log('Gallery: Fetching posts for entry IDs:', allEntryIds);

        // 2. 모든 엔트리들의 포스트 가져오기 (content만 필요)
        const {
          data,
          error
        } = await supabase.from('posts').select('id, content, title, created_at').in('wiki_entry_id', allEntryIds).order('created_at', {
          ascending: false
        });
        if (error) {
          console.error('Gallery fetch error:', error);
          throw error;
        }
        console.log('Gallery: Found posts:', data?.length || 0);

        // 포스트 content에서 이미지만 추출 (image_url 제외)
        const images: any[] = [];
        (data || []).forEach(post => {
          // content에서 img 태그 추출
          if (post.content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.content;
            const imgElements = tempDiv.querySelectorAll('img');
            imgElements.forEach((img, index) => {
              const src = img.src;
              if (src) {
                images.push({
                  id: `${post.id}-content-${index}`,
                  post_id: post.id,
                  media_url: src,
                  media_type: 'image',
                  caption: post.title,
                  created_at: post.created_at
                });
              }
            });
          }
        });
        console.log('Gallery: Extracted images from content:', images.length);
        return images;
      } catch (error) {
        console.error('Gallery error:', error);
        return [];
      }
    },
    enabled: !!entryId
  });

  // Member's artists fetch (for member entries)
  const {
    data: memberArtists
  } = useQuery({
    queryKey: ['member-artists', entryId, (entry?.metadata as any)?.group_id],
    queryFn: async () => {
      const metadata = entry?.metadata as any;
      if (!metadata?.group_id) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'artist').eq('id', metadata.group_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'member' && !!(entry?.metadata as any)?.group_id
  });

  // Parent entries fetch (from wiki_entry_relationships)
  const {
    data: parentEntries
  } = useQuery({
    queryKey: ['parent-entries', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data: relationships,
        error: relError
      } = await supabase.from('wiki_entry_relationships').select('parent_entry_id, relationship_type').eq('child_entry_id', entryId);
      if (relError) throw relError;
      if (!relationships || relationships.length === 0) return [];
      const parentIds = relationships.map(r => r.parent_entry_id);
      const {
        data: parents,
        error: parentError
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, schema_type, metadata').in('id', parentIds);
      if (parentError) throw parentError;

      // Merge relationship info with parent entries
      return parents?.map(parent => {
        const rel = relationships.find(r => r.parent_entry_id === parent.id);
        return {
          ...parent,
          relationship_type: rel?.relationship_type || ''
        };
      }) || [];
    },
    enabled: !!entryId
  });

  // Artist's members fetch (for artist entries)
  const {
    data: artistMembers
  } = useQuery({
    queryKey: ['artist-members', entryId, entry?.metadata],
    queryFn: async () => {
      if (!entryId || !entry) return [];

      // 1. wiki_entry_relationships에서 member_of 관계로 연결된 멤버 가져오기
      const {
        data: relationshipMembers,
        error: relError
      } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', entryId).eq('relationship_type', 'member_of');
      if (relError) throw relError;
      if (relationshipMembers && relationshipMembers.length > 0) {
        const memberIds = relationshipMembers.map(r => r.child_entry_id);
        const {
          data: members,
          error
        } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').in('id', memberIds);
        if (error) throw error;
        if (members && members.length > 0) return members;
      }

      // 2. 기존 방식: metadata.members의 이름으로 wiki_entries 검색 (fallback)
      const metadata = entry.metadata as any;
      if (metadata?.members && Array.isArray(metadata.members) && metadata.members.length > 0) {
        const memberNames = metadata.members.map((m: any) => typeof m === 'string' ? m : m.stage_name || m.real_name || '').filter(Boolean);
        if (memberNames.length > 0) {
          const {
            data: members,
            error
          } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'member').in('title', memberNames);
          if (error) throw error;
          return members || [];
        }
      }
      return [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'artist'
  });

  // Beauty product's brand fetch (for beauty_product entries)
  const {
    data: productBrand
  } = useQuery({
    queryKey: ['product-brand', entryId, (entry?.metadata as any)?.brand_id],
    queryFn: async () => {
      const metadata = entry?.metadata as any;
      if (!metadata?.brand_id) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'beauty_brand').eq('id', metadata.brand_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'beauty_product' && !!(entry?.metadata as any)?.brand_id
  });

  // Beauty brand's products fetch (for beauty_brand entries)
  const {
    data: brandProducts
  } = useQuery({
    queryKey: ['brand-products', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'beauty_product').eq('metadata->>brand_id', entryId).order('title', {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'beauty_brand'
  });

  // Food's restaurant fetch (for food entries)
  const {
    data: foodRestaurant
  } = useQuery({
    queryKey: ['food-restaurant', entryId, (entry?.metadata as any)?.restaurant_id],
    queryFn: async () => {
      const metadata = entry?.metadata as any;
      if (!metadata?.restaurant_id) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'restaurant').eq('id', metadata.restaurant_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'food' && !!(entry?.metadata as any)?.restaurant_id
  });

  // Restaurant's food items fetch (for restaurant entries)
  const {
    data: restaurantFoods
  } = useQuery({
    queryKey: ['restaurant-foods', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'food').eq('metadata->>restaurant_id', entryId).order('title', {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'restaurant'
  });

  // Food product's brand fetch (for food_product entries)
  const {
    data: foodProductBrand
  } = useQuery({
    queryKey: ['food-product-brand', entryId, (entry?.metadata as any)?.brand_id],
    queryFn: async () => {
      const metadata = entry?.metadata as any;
      if (!metadata?.brand_id) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'food_brand').eq('id', metadata.brand_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'food_product' && !!(entry?.metadata as any)?.brand_id
  });

  // Food brand's products fetch (for food_brand entries)
  const {
    data: foodBrandProducts
  } = useQuery({
    queryKey: ['food-brand-products', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entries').select('id, title, slug, image_url, metadata').eq('schema_type', 'food_product').eq('metadata->>brand_id', entryId).order('title', {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && !!entry && entry?.schema_type === 'food_brand'
  });
  const handleUploadClick = async () => {
    if (!selectedFile || !user || !entryId) return;

    // 포인트 확인
    const {
      data: profile
    } = await supabase.from('profiles').select('available_points').eq('id', user.id).single();
    const {
      data: pointRule
    } = await supabase.from('point_rules').select('points').eq('action_type', 'upload_wiki_media').eq('is_active', true).single();
    const pointCost = pointRule?.points || 0;
    if (pointCost < 0 && profile && profile.available_points < Math.abs(pointCost)) {
      toast({
        title: "Insufficient Stars",
        description: `You need ${Math.abs(pointCost)} stars to upload media.`,
        variant: "destructive"
      });
      return;
    }

    // 포인트 차감이 필요한 경우 확인 대화상자 표시
    if (pointCost < 0) {
      setUploadPointCost(Math.abs(pointCost));
      setIsConfirmUploadOpen(true);
    } else {
      // 포인트 차감이 없으면 바로 업로드
      await handleMediaUpload();
    }
  };
  const handleMediaUpload = async () => {
    if (!selectedFile || !user || !entryId) return;
    setIsUploadingMedia(true);
    try {
      // Upload to Supabase storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${entryId}/${Math.random()}.${fileExt}`;
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('wiki-images').upload(fileName, selectedFile);
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('wiki-images').getPublicUrl(fileName);

      // Save to gallery table
      const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      const {
        error: insertError
      } = await supabase.from('wiki_gallery').insert({
        wiki_entry_id: entryId,
        user_id: user.id,
        media_type: mediaType,
        media_url: publicUrl,
        caption: mediaCaption
      });
      if (insertError) throw insertError;

      // 포인트 차감
      if (uploadPointCost !== 0) {
        const {
          error: pointError
        } = await supabase.rpc('deduct_points', {
          user_id_param: user.id,
          action_type_param: 'upload_wiki_media',
          reference_id_param: entryId
        });
        if (pointError) {
          console.error('Point deduction error:', pointError);
        }
      }
      toast({
        title: "Success",
        description: "Media uploaded successfully"
      });
      setSelectedFile(null);
      setMediaCaption("");
      setIsUploadDialogOpen(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      refetchGallery();
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload media",
        variant: "destructive"
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };
  const handleDeleteMedia = async (mediaId: string, mediaUrl: string) => {
    if (!user) return;
    try {
      // Delete from storage
      const fileName = mediaUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('wiki-images').remove([`${entryId}/${fileName}`]);
      }

      // Delete from database
      const {
        error
      } = await supabase.from('wiki_gallery').delete().eq('id', mediaId);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Media deleted successfully"
      });
      refetchGallery();
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete media",
        variant: "destructive"
      });
    }
  };
  if (isLoading) {
    return (
      <V2Layout showBackButton={!isMobile}>
        <div className={`${isMobile ? 'pt-16' : ''} min-h-screen flex items-center justify-center`}>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </V2Layout>
    );
  }
  const metadata = entry?.metadata as any || {};
  const socialLinks = metadata.social_links || {};
  const musicCharts = metadata.music_charts || {};
  const isArtistEntry = entry?.schema_type === 'artist';
  const isMemberOrActorEntry = entry?.schema_type === 'member' || entry?.schema_type === 'actor';
  if (!entry) {
    return (
      <V2Layout showBackButton={!isMobile}>
        <div className={`${isMobile ? 'pt-16' : ''} min-h-screen flex items-center justify-center`}>
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Fanz entry not found</p>
            <Button onClick={() => navigate('/rankings')} className="rounded-full">Back to Fanz</Button>
          </div>
        </div>
      </V2Layout>
    );
  }
  // SEO 메타 태그 준비
  // HTML 태그 제거 함수
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, '').replace(/\s+/g, ' ').trim();
  };
  const pageTitle = `${entry.title} - Fanz | K-Pop Encyclopedia`;
  const plainContent = entry.content ? stripHtml(entry.content) : '';
  const pageDescription = plainContent ? plainContent.substring(0, 155) + '...' : `Explore ${entry.title} on Fanz - The ultimate K-Pop wiki and community platform`;
  const pageUrl = `https://k-trendz.com/k/${entry.slug || entry.id}`;
  const pageImage = entry.image_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png';
  const keywords = `${entry.title}, Fanz, K-Pop, K-Pop Wiki, ${entry.schema_type}, K-Pop Encyclopedia, Korean Pop, K-Culture`;
  return <>
      <Helmet>
        {/* 기본 메타 태그 */}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={pageUrl} />
        
        {/* Open Graph 태그 (Facebook, LinkedIn 등) */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${entry.title} | Fanz`} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="Fanz - K-Pop Wiki & Community" />
        <meta property="article:published_time" content={entry.created_at} />
        <meta property="article:modified_time" content={entry.updated_at} />
        <meta property="article:tag" content="K-Pop" />
        <meta property="article:tag" content={entry.schema_type} />
        
        {/* Twitter 카드 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${entry.title} | Fanz`} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageImage} />
        <meta name="twitter:site" content="@KTrendz" />
        
        {/* 구조화된 데이터 (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify({
          "@context": "https://schema.org",
          "@type": entry.schema_type === "member" || entry.schema_type === "actor" ? "Person" : "Thing",
          "name": entry.title,
          "description": pageDescription,
          "image": pageImage,
          "url": pageUrl,
          "datePublished": entry.created_at,
          "dateModified": entry.updated_at,
          "isPartOf": {
            "@type": "WebSite",
            "name": "Fanz",
            "url": "https://k-trendz.com"
          }
        })}
        </script>
      </Helmet>
      
      <V2Layout 
        pcHeaderTitle={entry.title} 
        showBackButton={true}
        headerRight={
          <div className="flex items-center gap-1">
            {isTranslatableLanguage && (
              <button
                onClick={toggleOriginal}
                disabled={isPageTranslating}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full bg-muted border border-border active:opacity-60"
              >
                {isPageTranslating ? (
                  <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : (
                  <span>{!showOriginal ? '🌐' : '🇺🇸'}</span>
                )}
                <span>{!showOriginal ? languageName : 'EN'}</span>
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: entry.title,
                    url: window.location.href
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Link copied!" });
                }
              }}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        }
      >
        <div className={`${isMobile ? 'px-3' : ''} pb-6 sm:pb-8`}>
          <div className="max-w-6xl mx-auto">
            {/* Admin actions */}
            {(isAdmin || isEntryAgent) && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isAdmin && <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Fanz Entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the Fanz entry
                            "{entry.title}" and all its history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full w-full sm:w-auto">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}
                  
                  {/* Link to Group button for admin on member entries */}
                  {isAdmin && entry.schema_type === 'member' && <LinkToGroupDialog memberId={entryId || ''} memberTitle={entry.title} currentGroupId={(entry.metadata as any)?.group_id} onGroupLinked={() => {
                  refetchEntry();
                  }} />}
                </div>

                <div className="flex items-center gap-2">
                  {/* Roles button for admin or entry agent */}
                  <Button variant="ghost" size="icon" onClick={() => setIsRoleManagerOpen(true)} className="rounded-full text-muted-foreground hover:text-foreground" title="Manage entry roles">
                      <Shield className="w-5 h-5" />
                    </Button>
                </div>
              </div>
            )}


            {/* 번역 배너 제거 - 헤더로 이동 */}

            {/* Announcement Marquee - Above Image */}
            {announcements && announcements.length > 0 && <div className="border border-border rounded-lg py-2 px-3 mb-2 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary shrink-0" />
                <div className="overflow-hidden flex-1">
                  <div className="whitespace-nowrap animate-marquee-fast">
                    {announcements.map((announcement, index) => <span key={announcement.id} className="text-sm text-foreground">
                        {announcement.title}
                        {index < announcements.length - 1 && <span className="mx-4 text-primary">•</span>}
                      </span>)}
                  </div>
                </div>
              </div>}

            {/* Header with image */}
            <div className="relative rounded-lg overflow-hidden bg-muted mb-4 sm:mb-6 max-w-full">
                {!entry.image_url || imageError ? <div className={`w-full h-64 flex items-center justify-center ${!hasFanzToken && (entry.votes || 0) < 1000 ? 'brightness-50' : ''}`}>
                    <ImageOff className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
                  </div> : <img src={entry.image_url} alt={entry.title} className={`w-full h-auto object-cover max-h-[70vh] ${!hasFanzToken && (entry.votes || 0) < 1000 ? 'brightness-50' : ''}`} onError={() => setImageError(true)} />}
                
                {/* Lock overlay for entries without fanz token and votes < 1000 */}
                {!hasFanzToken && (entry.votes || 0) < 1000 && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center justify-center text-white">
                      <Lock className="w-10 h-10 md:w-14 md:h-14" />
                    </div>
                    
                    {/* Unlock Progress Bar */}
                    <div className="w-full max-w-xs px-4 mt-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/80 font-medium">Unlock Progress</span>
                          <span className="text-white font-semibold">{Math.min(entry.votes || 0, 1000)} / 1,000</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                          <div className={`h-full rounded-full transition-all duration-500 ${(entry.votes || 0) < 100 ? 'bg-gray-400' : (entry.votes || 0) < 500 ? 'bg-blue-500' : (entry.votes || 0) < 800 ? 'bg-green-500' : 'bg-primary'}`} style={{
                    width: `${Math.min((entry.votes || 0) / 1000 * 100, 100)}%`
                  }} />
                        </div>
                      </div>
                    
                    {/* Vote component below lock - always visible */}
                    <div className="mt-4 pointer-events-auto bg-background rounded-full px-4 py-2 shadow-lg">
                      <VoteButtons votes={entry.votes || 0} userVote={userVote as "up" | "down" | null} onVote={handleVote} vertical={false} />
                    </div>
                  </div>}
                
                {/* 토큰 발행 중 로딩바 오버레이 */}
                {isTokenIssuing && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-3/4 max-w-md h-2 rounded-full overflow-hidden bg-gray-800">
                      <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-[length:200%_100%] animate-rainbow-flow" />
                    </div>
                    <div className="mt-3 bg-primary text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                      Issuing your Lightstick...
                    </div>
                  </div>}
                
                {/* Master Key Button - Top Right for owners and admins */}
                {(entry.owner_id === user?.id || isAdmin) && <Button variant="ghost" size="icon" onClick={() => navigate(`/k/${entry.slug || entryId}/edit`)} className="absolute top-2 right-2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/90 hover:bg-black text-white shadow-lg z-10" title="Master Dashboard">
                    <Key className="w-5 h-5 md:w-6 md:h-6" />
                  </Button>}
                
                {/* Trending Score - Top Left - Clickable */}
                {(isAdmin || isFollower) && (entry.aggregated_trending_score !== undefined || entry.trending_score !== undefined) && <Badge className="absolute top-2 left-2 text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold cursor-pointer hover:bg-[#ff4500]/90 transition-colors flex items-center gap-1 md:gap-1.5" onClick={() => setIsContributorsDialogOpen(true)}>
                    <Trophy className="w-3 h-3 md:w-4 md:h-4" />
                    {entry.aggregated_trending_score ?? entry.trending_score}
                  </Badge>}
                {/* Fanz Token Button Overlay */}
                <div className="absolute bottom-2 sm:bottom-4 left-2 right-2 flex items-center justify-center gap-2">
                  <FanzTokenButton wikiEntryId={entryId || ''} userId={user?.id || null} creatorId={entry.creator_id} ownerId={entry.owner_id} pageStatus={entry.page_status} votes={entry.votes || 0} followerCount={optimisticFollowerCount ?? (entry.follower_count || 0)} entryTitle={entry.title} onFollowChange={() => {
                setOptimisticFollowerCount(prev => {
                  const current = prev ?? (entry.follower_count || 0);
                  return isFollower ? current - 1 : current + 1;
                });
                refetchEntry();
                refetchIsFollower();
              }} onIssuingChange={isIssuing => setIsTokenIssuing(isIssuing)} />
                </div>
              </div>

            {/* Stats row - above title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground flex-wrap mb-3">
              <Badge variant="outline" className="capitalize text-xs">
                {(entry.schema_type || '').replace('_', ' ')}
              </Badge>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">{entry.view_count}</span>
              </span>
              {/* 팔로워 영역 */}
              <div className="flex items-center gap-1.5 py-1 px-2">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">{optimisticFollowerCount ?? entry.follower_count}</span>
              </div>
              {isFollower ? <div className="flex items-center gap-2 ml-auto bg-muted/50 border border-border rounded-full px-3 py-1.5">
                  <VoteButtons votes={entry.votes || 0} userVote={userVote as "up" | "down" | null} onVote={handleVote} vertical={false} />
                </div> : <div className="flex items-center gap-2 ml-auto">
                  <FanUpButton wikiEntryId={entryId || ''} userId={user?.id || null} followerCount={optimisticFollowerCount ?? (entry.follower_count || 0)} onFollowChange={() => {
                setOptimisticFollowerCount(prev => {
                  const current = prev ?? (entry.follower_count || 0);
                  return current + 1;
                });
                refetchEntry();
                refetchIsFollower();
              }} />
                </div>}
            </div>

            {/* About Card - Collapsible */}
            <Collapsible id="overview" open={isOverviewOpen} onOpenChange={setIsOverviewOpen}>
              <Card className="mb-4 sm:mb-6 bg-transparent border-none shadow-none">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer transition-colors py-3 sm:py-4 px-4 sm:px-6 opacity-80 bg-slate-100/0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-bold">
                          {pageT('title') || entry.title}
                          {entry.is_verified && <Badge className="bg-blue-500 gap-1 shrink-0 ml-2">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>}
                        </CardTitle>
                        {/* 커뮤니티 이름 (팬덤명) 표시 - 응원봉 발행 시 */}
                        {hasFanzToken && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs sm:text-sm text-muted-foreground/70">
                              {entry.community_name || "Community naming in progress..."}
                            </span>
                            {!entry.community_name && (
                              <a 
                                href="#community-proposals" 
                                className="text-xs text-primary hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  document.getElementById('community-proposals')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                              >
                                Vote now →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform shrink-0 ${isOverviewOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-4 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-md prose-img:max-w-full prose-headings:font-bold prose-h1:text-sm sm:text-base md:text-lg prose-h2:text-sm sm:text-base prose-h3:text-sm prose-h2:border-b prose-h2:pb-2 prose-h2:mb-4 prose-ul:list-disc prose-ol:list-decimal prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto break-words [&_*]:text-sm [&_*]:sm:text-base [&_b]:font-semibold [&_strong]:font-semibold [&_p]:leading-relaxed [&_div]:text-sm [&_div]:sm:text-base [&_*]:!bg-transparent [&_p]:!bg-transparent [&_div]:!bg-transparent">
                      {(() => {
                        // HTML 태그가 있는지 확인
                        const hasHtmlTags = /<[^>]+>/i.test(entry.content);
                        if (hasHtmlTags) {
                          // HTML 콘텐츠 렌더링
                          return <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none 
                                  prose-headings:text-foreground prose-p:text-muted-foreground 
                                  prose-strong:font-semibold prose-a:text-primary hover:prose-a:underline 
                                  prose-img:rounded-lg prose-img:shadow-md prose-img:max-w-full
                                  prose-h1:text-base sm:prose-h1:text-lg md:prose-h1:text-xl prose-h1:font-bold prose-h1:mb-3 prose-h1:mt-4
                                  prose-h2:text-sm sm:prose-h2:text-base prose-h2:font-bold prose-h2:border-b prose-h2:pb-2 prose-h2:mb-4 prose-h2:mt-3
                                  prose-h3:text-sm prose-h3:font-bold prose-h3:mb-2 prose-h3:mt-2
                                  prose-ul:list-disc prose-ol:list-decimal prose-li:text-muted-foreground
                                  prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
                                  prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                  [&_p]:leading-relaxed [&_*]:!bg-transparent break-words" dangerouslySetInnerHTML={{
                            __html: pageT('content') || entry.content
                          }} />;
                        }

                        // 마크다운 콘텐츠 렌더링
                        return <ReactMarkdown components={{
                          h1: ({
                            children
                          }) => <h1 className="text-base sm:text-lg md:text-xl font-bold mb-3 mt-4">{children}</h1>,
                          h2: ({
                            children
                          }) => <h2 className="text-sm sm:text-base md:text-lg font-bold mb-2 mt-4 pb-2 border-b">{children}</h2>,
                          h3: ({
                            children
                          }) => <h3 className="text-sm sm:text-base font-bold mb-2 mt-3">{children}</h3>,
                          p: ({
                            children
                          }) => <p className="mb-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">{children}</p>,
                          ul: ({
                            children
                          }) => <ul className="mb-3 space-y-1.5 text-xs sm:text-sm">{children}</ul>,
                          ol: ({
                            children
                          }) => <ol className="mb-3 space-y-1.5 text-xs sm:text-sm">{children}</ol>,
                          li: ({
                            children
                          }) => <li className="ml-5 text-xs sm:text-sm text-muted-foreground">{children}</li>,
                          blockquote: ({
                            children
                          }) => <blockquote className="border-l-4 border-primary pl-4 italic my-4 bg-muted/50 py-2 text-muted-foreground">
                                          {children}
                                        </blockquote>,
                          code: ({
                            inline,
                            children
                          }: any) => inline ? <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                                            {children}
                                          </code> : <code className="block bg-muted p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono text-foreground">
                                            {children}
                                          </code>,
                          a: ({
                            href,
                            children
                          }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                                          {children}
                                        </a>,
                          img: ({
                            src,
                            alt
                          }) => <img src={src} alt={alt || ''} className="rounded-lg shadow-md max-w-full h-auto my-4" loading="lazy" />
                        }}>
                          {(() => {
                            // 번역된 콘텐츠가 있으면 사용
                            const translatedContent = pageT('content');
                            if (translatedContent && translatedContent !== (entry.content || '')) {
                              return translatedContent;
                            }
                            // 원본에서 H1 제거
                            let cleanedContent = entry.content || '';
                            const h1Match = cleanedContent.match(/^# .+$/m);
                            const entryTitle = h1Match ? h1Match[0] : '';
                            const contentWithoutTitle = entryTitle ? cleanedContent.replace(entryTitle, '').trim() : cleanedContent;
                            return contentWithoutTitle;
                          })()}
                        </ReactMarkdown>;
                      })()}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>


            {/* Main content and fandom hub sections */}
            <div className="space-y-4 sm:space-y-6">
                {/* Sticky Navigation Tabs */}
                <div className="sticky top-0 z-10 flex justify-center py-3 -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0">
                  <div className="inline-flex gap-2 px-3 py-2 rounded-full bg-gray-100 dark:bg-background shadow-sm">
                    <button className={`text-xs sm:text-sm px-4 py-2 rounded-full flex items-center transition-colors ${activeSection === 'posts' ? 'bg-white dark:bg-card shadow-md text-foreground font-medium' : 'text-muted-foreground/60'}`} onClick={() => setActiveSection('posts')}>
                      <Coins className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 ${activeSection === 'posts' ? '' : 'opacity-60'}`} />
                      Fund
                    </button>
                    <button className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full flex items-center transition-colors ${activeSection === 'rankings' ? 'bg-white dark:bg-card shadow-md text-foreground font-medium' : 'text-muted-foreground/60'}`} onClick={() => setActiveSection('rankings')}>
                      <Trophy className={`w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-0.5 ${activeSection === 'rankings' ? '' : 'opacity-60'}`} />
                      <span className="hidden sm:inline">Rankings</span>
                    </button>
                    <button className={`text-xs sm:text-sm px-4 py-2 rounded-full flex items-center transition-colors ${activeSection === 'community' ? 'bg-white dark:bg-card shadow-md text-foreground font-medium' : 'text-muted-foreground/60'}`} onClick={() => setActiveSection('community')}>
                      <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 ${activeSection === 'community' ? '' : 'opacity-60'}`} />
                      Fanz
                    </button>
                    <button className={`text-xs sm:text-sm px-4 py-2 rounded-full flex items-center transition-colors ${activeSection === 'chats' ? 'bg-white dark:bg-card shadow-md text-foreground font-medium' : 'text-muted-foreground/60'}`} onClick={() => setActiveSection('chats')}>
                      <MessageCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 ${activeSection === 'chats' ? '' : 'opacity-60'}`} />
                      Chats
                    </button>
                  </div>
                </div>

                {/* Fund Section */}
                {activeSection === 'posts' && <div id="posts" className="mb-6">
                  {/* Community Fund & Proposals - 1000표 달성 또는 claimed/verified 상태일 때만 표시 */}
                  {((entry.votes || 0) >= 1000 || entry.page_status === 'claimed' || entry.page_status === 'verified') && (
                    <>
                      <div className="mb-6">
                        <SupportFundCard wikiEntryId={entryId || ''} variant="full" showOriginal={showOriginal} />
                      </div>

                      {/* Community Proposals Section */}
                      <div id="community-proposals" className="mb-6">
                        <SupportProposals wikiEntryId={entryId || ''} variant="full" ownerId={entry.owner_id} showOriginal={showOriginal} />
                      </div>
                    </>
                  )}

                  {/* 잠금 상태이고 1000표 미만일 때만 응원봉 + 달성률 그래프 표시 */}
                  {entry.page_status !== 'claimed' && entry.page_status !== 'verified' && (entry.votes || 0) < 1000 ? <div className="flex flex-col items-center pt-2 pb-16">
                      {/* 응원봉 이미지 */}
                      <img src="/images/ktrendz_lightstick.webp" alt="KTRENDZ Lightstick" className="w-80 h-80 sm:w-96 sm:h-96 object-contain mb-4" />
                      
                      {/* 타이틀 */}
                      <div className="flex items-center gap-2 mb-6">
                        <h2 className="text-sm sm:text-base font-medium text-muted-foreground">VOTE TO CREATE LIGHTSTICK</h2>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-primary transition-colors">
                              <HelpCircle className="w-4 h-4" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md mx-4">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <img src="/images/ktrendz_lightstick.webp" alt="Lightstick" className="w-8 h-8" />
                                What are Light Sticks?
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-sm text-muted-foreground">
                              <p>
                                <strong className="text-foreground">Light Sticks</strong> are NFT-based digital collectibles on Base Network that represent your support for your favorite artists.
                              </p>
                              <div className="space-y-2">
                                <h4 className="font-medium text-foreground">How to Create:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  <li>Reach 1,000 votes to unlock Lightstick creation</li>
                                  <li>Once unlocked, fans can purchase and collect</li>
                                  <li>20% of all transactions goes to Artist Fund</li>
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <h4 className="font-medium text-foreground">Benefits:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  <li>Vote on community support proposals</li>
                                  <li>Boost the fan page ranking score</li>
                                  <li>Access exclusive content</li>
                                  <li>On-chain proof of fandom</li>
                                </ul>
                              </div>
                              <p className="text-xs border-t pt-3 mt-3">
                                Your votes help create Lightsticks for this artist!
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      {/* 달성률 표시 */}
                      <div className="w-full max-w-sm mb-8 px-4 sm:px-0">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-muted-foreground">Creation Progress</span>
                          <span className="font-medium">{Math.min(entry.votes || 0, 1000).toLocaleString()} / 1,000 votes</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${(entry.votes || 0) < 100 ? 'bg-gray-400' : (entry.votes || 0) < 500 ? 'bg-blue-500' : (entry.votes || 0) < 800 ? 'bg-green-500' : 'bg-primary'}`} style={{
                      width: `${Math.min((entry.votes || 0) / 1000 * 100, 100)}%`
                    }} />
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          {1000 - (entry.votes || 0)} more votes needed to create Lightstick
                        </p>
                      </div>
                    </div> : null}
                </div>}

                {/* Related Tag Posts Section - only show in posts tab */}
                {activeSection === 'posts' && relatedTagPosts && relatedTagPosts.length > 0 && <Collapsible defaultOpen={true}>
                    <Card id="related-tag-posts" className="mb-6">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                              <CardTitle className="text-foreground">Related Tag Posts</CardTitle>
                              <ChevronDown className="h-5 w-5 transition-transform duration-200 ui-expanded:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          {/* 이 엔트리의 태그 버튼 */}
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Badge variant={selectedTagFilter === null ? "default" : "outline"} className="cursor-pointer rounded-full" onClick={() => setSelectedTagFilter(null)}>
                              All
                            </Badge>
                            {wikiTags && wikiTags.map((tag: any) => <Badge key={tag.tag_id} variant={selectedTagFilter === tag.tag_id ? "default" : "outline"} className="cursor-pointer rounded-full" onClick={() => setSelectedTagFilter(tag.tag_id)}>
                                {tag.wiki_tags?.name}
                              </Badge>)}
                          </div>
                        </CollapsibleContent>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="space-y-4">
                            {(selectedTagFilter ? relatedTagPosts.filter((post: any) => {
                        // 선택된 태그를 가진 포스트만 필터링 - post_tags 확인 필요
                        return wikiTags?.some((tag: any) => tag.tag_id === selectedTagFilter);
                      }) : relatedTagPosts).map((post: any) => <PostCard key={post.id} id={post.id} title={post.title} content={post.content} author={post.profiles?.display_name || post.profiles?.username || 'Unknown'} authorAvatarUrl={post.profiles?.avatar_url} category={post.category || 'general'} votes={post.votes || 0} commentCount={0} createdAt={new Date(post.created_at)} userVote={post.userVote} onVote={handleRelatedTagPostVote} imageUrl={post.image_url} sourceUrl={post.source_url} userId={post.user_id} currentUserId={user?.id} onRefresh={refetchRelatedTagPosts} wikiEntryTitle={entry.title} wikiEntryId={entryId} metadata={post.metadata} visibility={post.visibility} isFollowing={isFollower} eventDate={post.event_date} userTokenBalance={userTokenBalance} isPageOwner={entry?.owner_id === user?.id} />)}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>}

                {/* Brand Products Section (Beauty Brand only) */}
                {entry.schema_type === 'beauty_brand' && brandProducts && brandProducts.length > 0 && <Card id="products">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Products
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {brandProducts.map((product: any) => <Card key={product.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${product.slug}`)}>
                            <CardContent className="p-4 text-center">
                              {product.image_url ? <img src={product.image_url} alt={product.title} className="w-20 h-20 mx-auto mb-3 rounded-lg object-cover" /> : <div className="w-20 h-20 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <ImageIcon className="w-10 h-10 text-primary" />
                                </div>}
                              <h3 className="font-semibold text-sm group-hover:text-white line-clamp-2">{product.title}</h3>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Brand Section (Beauty Product only) */}
                {entry.schema_type === 'beauty_product' && productBrand && productBrand.length > 0 && <Card id="brand">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Brand
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {productBrand.map((brand: any) => <Card key={brand.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${brand.slug}`)}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                {brand.image_url ? <img src={brand.image_url} alt={brand.title} className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-white/20">
                                    <Users className="w-10 h-10 text-primary group-hover:text-white" />
                                  </div>}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-lg mb-1 group-hover:text-white">{brand.title}</h4>
                                </div>
                              </div>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Restaurant Foods Section (Restaurant only) */}
                {entry.schema_type === 'restaurant' && restaurantFoods && restaurantFoods.length > 0 && <Card id="foods">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Menu Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {restaurantFoods.map((food: any) => <Card key={food.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${food.slug}`)}>
                            <CardContent className="p-4 text-center">
                              {food.image_url ? <img src={food.image_url} alt={food.title} className="w-20 h-20 mx-auto mb-3 rounded-lg object-cover" /> : <div className="w-20 h-20 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <ImageIcon className="w-10 h-10 text-primary" />
                                </div>}
                              <h3 className="font-semibold text-sm group-hover:text-white line-clamp-2">{food.title}</h3>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Restaurant Section (Food only) */}
                {entry.schema_type === 'food' && foodRestaurant && foodRestaurant.length > 0 && <Card id="restaurant">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Restaurant
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {foodRestaurant.map((restaurant: any) => <Card key={restaurant.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${restaurant.slug}`)}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                {restaurant.image_url ? <img src={restaurant.image_url} alt={restaurant.title} className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-white/20">
                                    <Users className="w-10 h-10 text-primary group-hover:text-white" />
                                  </div>}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-lg mb-1 group-hover:text-white">{restaurant.title}</h4>
                                </div>
                              </div>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Food Brand Products Section (Food Brand only) */}
                {entry.schema_type === 'food_brand' && foodBrandProducts && foodBrandProducts.length > 0 && <Card id="products">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Products
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {foodBrandProducts.map((product: any) => <Card key={product.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${product.slug}`)}>
                            <CardContent className="p-4 text-center">
                              {product.image_url ? <img src={product.image_url} alt={product.title} className="w-20 h-20 mx-auto mb-3 rounded-lg object-cover" /> : <div className="w-20 h-20 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <ImageIcon className="w-10 h-10 text-primary" />
                                </div>}
                              <h3 className="font-semibold text-sm group-hover:text-white line-clamp-2">{product.title}</h3>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Brand Section (Food Product only) */}
                {entry.schema_type === 'food_product' && foodProductBrand && foodProductBrand.length > 0 && <Card id="brand">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Brand
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {foodProductBrand.map((brand: any) => <Card key={brand.id} className="group cursor-pointer hover:bg-primary transition-colors" onClick={() => navigate(`/k/${brand.slug}`)}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                {brand.image_url ? <img src={brand.image_url} alt={brand.title} className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-white/20">
                                    <Users className="w-10 h-10 text-primary group-hover:text-white" />
                                  </div>}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-lg mb-1 group-hover:text-white">{brand.title}</h4>
                                </div>
                              </div>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}




                {/* Community Section - 팬들이 글 작성 가능 */}
                {activeSection === 'community' && <div id="community" className="mb-6">
                  {user && (isFollower || isAdmin) && <div className="flex justify-end mb-4">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/create?wiki_entry=${entryId}`)} className="rounded-full gap-2">
                        <Pencil className="w-4 h-4" />
                        Create Post
                      </Button>
                    </div>}
                  <div>
                    {<>
                        {isFetchingFanPosts && fanPostsPage === 1 ? <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div> : allFanPosts && allFanPosts.length > 0 ? <>
                            <div>
                              {(selectedTagFilter ? displayedFanPosts : allFanPosts)?.map((post: any, index: number, array: any[]) => <div key={post.id}>
                                  <PostCard id={post.id} title={post.title} content={post.content} author={post.profiles?.username || 'anonymous'} authorAvatarUrl={post.profiles?.avatar_url} category={post.category || 'general'} votes={post.votes || 0} commentCount={0} createdAt={new Date(post.created_at)} userVote={post.userVote} onVote={handleFanPostVote} imageUrl={post.image_url} sourceUrl={post.source_url} userId={post.user_id} currentUserId={user?.id} onRefresh={refetchFanPosts} wikiEntryTitle={entry.title} wikiEntryId={entryId} wikiEntryCreatorId={entry.creator_id} showCommentSection={expandedPostId === post.id} onCommentClick={handleCommentClick} metadata={post.metadata} isFollowing={isFollower} eventDate={post.event_date} userTokenBalance={userTokenBalance} isPageOwner={entry?.owner_id === user?.id} />
                                  {expandedPostId === post.id && <div className="ml-4 pl-4 py-4 border-l-2 border-border bg-muted/20">
                                      <CommentSection comments={postComments.get(post.id) || []} currentUserId={user?.id} postAuthorId={post.user_id} wikiCreatorId={entry.creator_id} commentVotes={commentVotes.get(post.id) || new Map()} onAddComment={(content, parentId) => handleAddComment(post.id, content, parentId)} onVoteComment={(commentId, type) => handleVoteComment(post.id, commentId, type)} onDeleteComment={commentId => handleDeleteComment(post.id, commentId)} />
                                    </div>}
                                  {index < array.length - 1 && !expandedPostId && <div className="my-4 border-b border-muted"></div>}
                                </div>)}
                            </div>
                            {hasMoreFanPosts && <div id="fan-posts-sentinel" className="flex justify-center py-4">
                                {isFetchingFanPosts && <div className="flex items-center gap-2 text-muted-foreground">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span>Loading more posts...</span>
                                  </div>}
                              </div>}
                          </> : <div className="text-center py-8 text-muted-foreground">
                            <p className="mb-2">Any fan can create a post here!</p>
                            <p className="text-xs mb-4">Your posts help boost this artist's score!</p>
                            <Button variant="ghost" onClick={() => {
                      if (!isFollower && !isAdmin && !isFollowerLoading) {
                        console.log('No posts create button blocked:', {
                          isFollower,
                          isAdmin,
                          isFollowerLoading
                        });
                        toast({
                          title: "Fan Up Required",
                          description: "You must be a fan of this entry to create posts. Please fan up first!",
                          variant: "destructive"
                        });
                        return;
                      }
                      navigate(`/create?wiki_entry=${entryId}`);
                    }} className="rounded-full gap-2 border border-current">
                              <Pencil className="w-4 h-4" />
                              Create Post
                            </Button>
                          </div>}
                      </>}
                  </div>
                </div>}

                {/* Chats Section */}
                {activeSection === 'chats' && <div id="chats" className="mb-6">
                  <WikiEntryChatrooms 
                    wikiEntryId={entryId || ''} 
                    hasLightstick={userTokenBalance >= 1} 
                  />
                </div>}

                {/* Rankings Section - Top Contributors */}
                {activeSection === 'rankings' && <div id="rankings" className="mb-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Trophy className="w-5 h-5 text-primary" />
                        Top Contributors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topContributors && topContributors.length > 0 ? <div className="space-y-3">
                          {topContributors.slice(0, 10).map((contributor: any, index: number) => <div key={contributor.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/u/${contributor.profiles?.username}`)}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-white' : index === 1 ? 'bg-gray-400 text-white' : index === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {index + 1}
                              </div>
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={contributor.profiles?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {(contributor.profiles?.display_name || contributor.profiles?.username || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {contributor.profiles?.display_name || contributor.profiles?.username}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {contributor.contribution_score} pts
                                </p>
                              </div>
                              {contributor.profiles?.is_verified && <Verified className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                            </div>)}
                        </div> : <p className="text-sm text-muted-foreground text-center py-4">
                          No contributors yet
                        </p>}
                    </CardContent>
                  </Card>
                </div>}

                {/* Upcoming Events Section */}
                {activeSection === 'events' && upcomingEvents && upcomingEvents.length > 0 && <Card id="events">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        Upcoming Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingEvents.map((event: any) => <Card key={event.id}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h4 className="font-semibold mb-1">{event.title}</h4>
                                  {event.description && <p className="text-sm text-muted-foreground mb-2">{event.description}</p>}
                                  <Badge variant="outline">{event.event_type}</Badge>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-semibold">{format(new Date(event.event_date), 'MMM d')}</div>
                                  <div className="text-xs text-muted-foreground">{format(new Date(event.event_date), 'yyyy')}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>)}
                      </div>
                    </CardContent>
                  </Card>}


              </div>

            {/* Back to Wiki button */}
          </div>

        {/* Lightbox Dialog */}
        <Dialog open={!!lightboxImage} onOpenChange={open => !open && setLightboxImage(null)}>
          <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            {lightboxImage && <div className="flex flex-col items-center justify-center gap-4 cursor-pointer" onClick={() => setLightboxImage(null)}>
                {lightboxImage.type === 'image' ? <img src={lightboxImage.url} alt={lightboxImage.caption || 'Gallery image'} className="max-w-[95vw] max-h-[95vh] object-contain" /> : <video src={lightboxImage.url} className="max-w-[95vw] max-h-[95vh] object-contain" controls autoPlay onClick={e => e.stopPropagation()} />}
                {lightboxImage.caption && <p className="text-sm text-white/80 text-center px-4">{lightboxImage.caption}</p>}
              </div>}
          </DialogContent>
        </Dialog>

        {/* Upload Confirmation Dialog */}
        <AlertDialog open={isConfirmUploadOpen} onOpenChange={setIsConfirmUploadOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Upload</AlertDialogTitle>
              <AlertDialogDescription>
                Uploading media will cost {uploadPointCost} points. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full w-full sm:w-auto">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction className="rounded-full w-full sm:w-auto" onClick={async () => {
              setIsConfirmUploadOpen(false);
              await handleMediaUpload();
            }}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Role Manager Dialog */}
        <Dialog open={isRoleManagerOpen} onOpenChange={setIsRoleManagerOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Entry Roles</DialogTitle>
              <DialogDescription>
                Assign entry agents and moderators for {entry?.title}
              </DialogDescription>
            </DialogHeader>
            <WikiEntryRoleManager preSelectedEntryId={entryId} />
          </DialogContent>
        </Dialog>

        {/* Top Contributors Dialog */}
        <Dialog open={isContributorsDialogOpen} onOpenChange={setIsContributorsDialogOpen}>
          <DialogContent className="sm:max-w-2xl mx-4 max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Top Contributors
              </DialogTitle>
              <DialogDescription>
                Users who contributed most to {entry?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {topContributors && topContributors.length > 0 ? topContributors.map((contributor: any, index: number) => <div key={contributor.user_id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    {/* Rank */}
                    <span className={`text-base sm:text-lg font-bold min-w-[1.5rem] sm:min-w-[2rem] ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      #{index + 1}
                    </span>
                    
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 sm:h-12 sm:w-12 flex-shrink-0">
                      <AvatarImage src={contributor.profiles?.avatar_url} />
                      <AvatarFallback>
                        {(contributor.profiles?.display_name || contributor.profiles?.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {contributor.profiles?.display_name || contributor.profiles?.username}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        <span className="hidden sm:inline">
                          {contributor.posts_count} posts · {contributor.comments_count} comments · {contributor.votes_received} upvotes
                        </span>
                        <span className="sm:hidden">
                          {contributor.posts_count}P · {contributor.comments_count}C · {contributor.votes_received}↑
                        </span>
                      </p>
                    </div>
                    
                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold text-primary">
                        {contributor.contribution_score}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">points</p>
                    </div>
                  </div>) : <div className="text-center py-8 text-muted-foreground">
                  <p>No contributors yet</p>
                </div>}
            </div>
          </DialogContent>
        </Dialog>

        {/* Followers Dialog */}
        <Dialog open={isFollowersDialogOpen} onOpenChange={setIsFollowersDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Fanz ({(optimisticFollowerCount ?? entry?.follower_count) || 0})
              </DialogTitle>
              <DialogDescription>
                People who are fans of this entry
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {loadingFollowers ? <div className="text-center py-8 text-muted-foreground">
                  <p>Loading...</p>
                </div> : followers.length > 0 ? <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {followers.map(follower => <div key={follower.user_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => {
                navigate(`/u/${follower.profiles?.username}`);
                setIsFollowersDialogOpen(false);
              }}>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={follower.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {follower.profiles?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {follower.profiles?.display_name || follower.profiles?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{follower.profiles?.username}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {timeAgo(follower.created_at)}
                      </div>
                    </div>)}
                </div> : <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No fans yet</p>
                  <p className="text-sm mt-2">Be the first to become a fan!</p>
                </div>}
            </div>
          </DialogContent>
        </Dialog>

        {/* Owner Application Dialog */}
        {user && entry && <OwnerApplicationDialog open={isOwnerApplicationOpen} onOpenChange={setIsOwnerApplicationOpen} entryId={entry.id} entryTitle={entry.title} userId={user.id} onSuccess={() => refetchApplication()} />}

        {/* Fan Cover Image Dialog */}
        {user && entry && <FanCoverImageDialog open={isFanCoverDialogOpen} onOpenChange={setIsFanCoverDialogOpen} wikiEntryId={entry.id} entryTitle={entry.title} userId={user.id} userTokenBalance={userTokenBalance} onSuccess={() => refetchEntry()} />}

        {/* Purchase Celebration Dialog */}
        {entry && <PurchaseCelebrationDialog 
          open={showCelebrationDialog} 
          onOpenChange={setShowCelebrationDialog} 
          entryTitle={entry.title}
          entrySlug={entry.slug}
          userName={profile?.display_name || profile?.username}
          userAvatar={profile?.avatar_url || undefined}
          tokenBalance={purchasedTokenBalance}
        />}

        {/* Lightstick Holders Dialog */}
        {fanzTokenData && (
          <FanzTokenHoldersDialog
            open={showLightstickHoldersDialog}
            onOpenChange={setShowLightstickHoldersDialog}
            tokenId={fanzTokenData.id}
            tokenStringId={fanzTokenData.token_id || ''}
            entryTitle={entry?.title || ''}
          />
        )}

        {!user && <SignupCTA className="mx-4 sm:mx-8 mb-8" />}
        </div>
      </V2Layout>
    </>;
};

export default WikiDetail;
