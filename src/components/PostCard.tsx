// PostCard 컴포넌트 - 포스트 카드 렌더링
import { MessageSquare, Pin, Zap, MoreVertical, Trash2, BadgeCheck, Crown, ChevronDown, ChevronUp, Trophy, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import VoteButtons from "./VoteButtons";
import { BoostPostDialog } from "./BoostPostDialog";
import MentionText from "./MentionText";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

type PostVisibility = 'public' | 'fans_only' | string;

type PostMetadata = Record<string, unknown>;

interface PostCardProps {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  votes: number;
  commentCount: number;
  createdAt: Date;
  userVote?: "up" | "down" | null;
  onVote: (postId: string, type: "up" | "down") => void;
  imageUrl?: string;
  sourceUrl?: string;
  currentSection?: string;
  communityId?: string;
  communityName?: string;
  communitySlug?: string;
  communityIcon?: string;
  authorAvatarUrl?: string;
  authorIsVerified?: boolean;
  authorVerificationType?: string;
  isPinned?: boolean;
  isBoosted?: boolean;
  boostedUntil?: string;
  userId?: string;
  currentUserId?: string;
  onRefresh?: () => void;
  rank?: number;
  rankChange?: number;
  wikiEntryTitle?: string;
  wikiEntryId?: string;
  wikiEntrySlug?: string;
  wikiEntryCreatorId?: string;
  trendingScore?: number;
  showCommentSection?: boolean;
  onCommentClick?: (postId: string) => void;
  metadata?: PostMetadata | null;
  visibility?: PostVisibility;
  isFollowing?: boolean;
  userTokenBalance?: number;
  eventDate?: string | null;
  isPageOwner?: boolean;
  slug?: string;
}

const PostCard = ({
  id,
  title,
  content,
  author,
  category,
  votes,
  commentCount,
  createdAt,
  userVote,
  onVote,
  imageUrl,
  sourceUrl,
  currentSection = "all",
  communityId,
  communityName,
  communitySlug,
  communityIcon,
  authorAvatarUrl,
  authorIsVerified,
  authorVerificationType,
  isPinned,
  isBoosted,
  boostedUntil,
  userId,
  currentUserId,
  onRefresh,
  rank,
  rankChange,
  wikiEntryTitle,
  wikiEntryId,
  wikiEntrySlug,
  wikiEntryCreatorId,
  trendingScore,
  showCommentSection = false,
  onCommentClick,
  metadata,
  visibility,
  isFollowing = false,
  userTokenBalance = 0,
  eventDate,
  isPageOwner = false,
  slug,
}: PostCardProps) => {
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBoostDialog, setShowBoostDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [realtimeVotes, setRealtimeVotes] = useState(votes);
  const isOwnPost = !!userId && !!currentUserId && userId === currentUserId;
  const canDelete = isAdmin || isModerator;

  // Wiki entry인 경우 적절한 URL 생성, 일반 포스트는 slug 사용
  const getPostUrl = () => {
    if (id.startsWith('wiki-') && wikiEntrySlug) {
      return `/k/${wikiEntrySlug}`;
    }
    // slug가 있으면 /p/slug 형식 사용
    if (slug) {
      return `/p/${slug}`;
    }
    return `/post/${id}`;
  };

  const postUrl = getPostUrl();

  // 실시간 투표 업데이트 구독
  useEffect(() => {
    // 위키 엔트리인 경우
    if (id.startsWith('wiki-')) {
      const wikiId = id.replace('wiki-', '');
      const channel = supabase
        .channel(`wiki-entry-${wikiId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wiki_entries',
            filter: `id=eq.${wikiId}`
          },
          (payload) => {
            console.log('Real-time wiki vote update:', payload);
            if (payload.new && typeof payload.new.aggregated_votes === 'number') {
              setRealtimeVotes(payload.new.aggregated_votes);
            } else if (payload.new && typeof payload.new.votes === 'number') {
              setRealtimeVotes(payload.new.votes);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // 일반 포스트인 경우
      const channel = supabase
        .channel(`post-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'posts',
            filter: `id=eq.${id}`
          },
          (payload) => {
            console.log('Real-time vote update:', payload);
            if (payload.new && typeof payload.new.votes === 'number') {
              setRealtimeVotes(payload.new.votes);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  // props에서 votes가 변경되면 realtime votes도 업데이트
  useEffect(() => {
    setRealtimeVotes(votes);
  }, [votes]);

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
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
    
    return "just now";
  };

  // HTML 엔티티 디코딩 및 HTTPS 변환 함수
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    // HTTP를 HTTPS로 자동 변환
    const httpsUrl = text.replace(/^http:\/\//i, 'https://');
    return httpsUrl.replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
  };

  // HTML 태그 및 마크다운 문법 제거하고 순수 텍스트만 추출
  const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    
    try {
      // HTML 엔티티를 먼저 디코딩한 후, 정규식으로 HTML 태그 제거 (복잡한 HTML도 처리)
      let text = decodeHtmlEntities(html)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script 태그 제거
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // style 태그 제거
        .replace(/<[^>]+>/g, '') // 모든 HTML 태그 제거
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&[a-z0-9]+;/gi, ' '); // 기타 HTML 엔티티 제거
      
      // 마크다운 문법 제거
      text = text
        .replace(/#{1,6}\s+/g, '') // 헤딩 (# ## ### 등)
        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold **text**
        .replace(/\*(.+?)\*/g, '$1') // Italic *text*
        .replace(/__(.+?)__/g, '$1') // Bold __text__
        .replace(/_(.+?)_/g, '$1') // Italic _text_
        .replace(/~~(.+?)~~/g, '$1') // Strikethrough ~~text~~
        .replace(/`{1,3}[^`\n]+`{1,3}/g, '') // Code blocks
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links [text](url)
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '') // Images ![alt](url)
        .replace(/^>\s+/gm, '') // Blockquotes
        .replace(/^[-*+]\s+/gm, '') // List items
        .replace(/^\d+\.\s+/gm, ''); // Numbered list items
      
      // 여러 공백을 단일 공백으로 변환하고 앞뒤 공백 제거
      return text.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Error stripping HTML tags:', error);
      return '';
    }
  };

  // 커버 이미지가 없으면 본문의 첫 이미지 추출
  const getDisplayImage = (): string | null => {
    if (imageUrl) return imageUrl;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const firstImg = tempDiv.querySelector('img');
    return firstImg?.src || null;
  };

  const displayImage = getDisplayImage();

  // 이미지 블러 처리 여부 확인 (포스트 공개설정 기준)
  const shouldBlurImage = (): boolean => {
    // 관리자/모더레이터/페이지 운영자는 블러 처리 우회
    if (isAdmin || isModerator || isPageOwner) return false;

    // 작성자는 블러 처리 없음
    if (isOwnPost) return false;

    const v = visibility || 'public';

    // Fans-only 포스트는 팔로워만 이미지 열람 가능
    if (v === 'fans_only') return !isFollowing;

    return false;
  };

  const imageBlurred = shouldBlurImage();

  // 블러 이유 메시지
  const getBlurReason = (): string => {
    const v = visibility || 'public';
    if (v === 'fans_only') return 'Fans Only';
    return '';
  };
  
  // 조건 미충족 시 접근 차단 핸들러
  const handleRestrictedClick = (e: React.MouseEvent) => {
    if (imageBlurred) {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: "Access Restricted",
        description: getBlurReason(),
        variant: "destructive"
      });
    }
  };
  const [pointCosts, setPointCosts] = useState({
    boostPerHour: 5
  });

  useEffect(() => {
    const fetchPointCosts = async () => {
      const { data } = await supabase
        .from('point_rules')
        .select('action_type, points')
        .eq('action_type', 'boost_post_per_hour');
      
      if (data && data.length > 0) {
        setPointCosts({
          boostPerHour: Math.abs(data[0].points)
        });
      }
    };
    fetchPointCosts();
  }, []);

  const handlePinPost = async () => {
    if (!currentUserId || !isAdmin) {
      toast({ title: "Access Denied", description: "Only admins can pin posts", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('pin_post', { post_id_param: id });
      
      if (error) throw error;
      
      toast({ title: "Post pinned!", description: "This post is now pinned at the top" });
      onRefresh?.();
    } catch (error: any) {
      console.error('Error pinning post:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to pin post", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnpinPost = async () => {
    if (!currentUserId || !isAdmin) {
      toast({ title: "Access Denied", description: "Only admins can unpin posts", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('unpin_post', { post_id_param: id });
      
      if (error) throw error;
      
      toast({ title: "Post unpinned!", description: "This post is no longer pinned" });
      onRefresh?.();
    } catch (error: any) {
      console.error('Error unpinning post:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to unpin post", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBoostPost = async (hours: number) => {
    if (!currentUserId) {
      toast({ title: "Please sign in", description: "You must be signed in to boost posts", variant: "destructive" });
      return;
    }
    
    const totalCost = pointCosts.boostPerHour * hours;
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('boost_post', { 
        post_id_param: id, 
        duration_hours: hours 
      });
      
      if (error) {
        if (error.message.includes('Insufficient points')) {
          toast({
            title: "Insufficient Stars",
            description: `You need ${totalCost} stars to boost for ${hours} hour(s)`,
            variant: "destructive" 
          });
        } else if (error.message.includes('Invalid duration')) {
          toast({ 
            title: "Invalid Duration", 
            description: "Maximum boost duration is 72 hours (3 days)", 
            variant: "destructive" 
          });
        } else {
          throw error;
        }
        return;
      }
      
      toast({ 
        title: "Post boosted!", 
        description: `Your post is boosted for ${hours} hour(s) (${(hours/24).toFixed(1)} day${hours !== 24 ? 's' : ''})` 
      });
      setShowBoostDialog(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error boosting post:', error);
      toast({ title: "Error", description: "Failed to boost post", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePost = async () => {
    if (!canDelete) {
      toast({ title: "Access Denied", description: "Only moderators and admins can delete posts", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    try {
      // wiki- 접두사가 있는 경우 wiki_entries에서 삭제, 아니면 posts에서 삭제
      const isWikiEntry = id.startsWith('wiki-');
      const actualId = isWikiEntry ? id.replace('wiki-', '') : id;
      
      if (isWikiEntry) {
        const { error } = await supabase
          .from('wiki_entries')
          .delete()
          .eq('id', actualId);
        
        if (error) throw error;
        toast({ title: "Entry deleted", description: "The entry has been successfully deleted" });
      } else {
        const { error } = await supabase
          .from('posts')
          .delete()
          .eq('id', actualId);
        
        if (error) throw error;
        toast({ title: "Post deleted", description: "The post has been successfully deleted" });
      }
      
      setShowDeleteDialog(false);
      onRefresh?.();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-3 md:p-4 bg-card hover:bg-muted/40 transition-all relative">
      <div className="absolute top-2 right-2 flex gap-1 items-center z-10">
        {isPinned && (
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Pin className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
        {isBoosted && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Zap className="w-3 h-3 text-primary" />
            Boosted
          </Badge>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isProcessing}
            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
            title="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex gap-2 md:gap-4">
        {/* 데스크톱: 이미지가 왼쪽에 독립적으로 배치 */}
        {displayImage && (
          <Link 
            to={imageBlurred ? '#' : postUrl} 
            state={{ from: `/?section=${currentSection}` }} 
            className="hidden md:block flex-shrink-0" 
            onClick={(e) => {
              if (imageBlurred) {
                handleRestrictedClick(e);
              } else {
                sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
              }
            }}
          >
            <div className="w-40 h-40 lg:w-48 lg:h-48 rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity relative">
              <img 
                src={decodeHtmlEntities(displayImage)} 
                alt={title}
                className={`w-full h-full object-cover ${imageBlurred ? 'blur-xl' : ''}`}
                loading="lazy"
              />
              {imageBlurred && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                  <Lock className="w-8 h-8 text-white mb-2" />
                  <span className="text-white text-xs font-medium px-3 py-1.5 bg-black/60 rounded-full">
                    {getBlurReason()}
                  </span>
                </div>
              )}
              {/* 순위 표시 (이미지 내 좌상단) */}
              {rank && (
                <Badge className="absolute top-2 left-2 text-sm px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground font-bold shadow-lg">
                  #{rank}
                </Badge>
              )}
            </div>
          </Link>
        )}
        
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-between">
          <div>
            {/* 모바일: 이미지와 타이틀을 같은 행에 배치 */}
            <div className="flex gap-2 mb-2 md:mb-0">
              {displayImage && (
                <Link 
                  to={imageBlurred ? '#' : postUrl} 
                  state={{ from: `/?section=${currentSection}` }} 
                  className="md:hidden flex-shrink-0" 
                  onClick={(e) => {
                    if (imageBlurred) {
                      handleRestrictedClick(e);
                    } else {
                      sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
                    }
                  }}
                >
                  <div className="w-24 h-24 rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity relative">
                    <img 
                      src={decodeHtmlEntities(displayImage)} 
                      alt={title}
                      className={`w-full h-full object-cover ${imageBlurred ? 'blur-xl' : ''}`}
                      loading="lazy"
                    />
                    {imageBlurred && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <Lock className="w-5 h-5 text-white mb-1" />
                        <span className="text-white text-[8px] font-medium px-1.5 py-0.5 bg-black/60 rounded-full text-center leading-tight">
                          {getBlurReason()}
                        </span>
                      </div>
                    )}
                    {/* 순위 표시 (이미지 내 좌상단) */}
                    {rank && (
                      <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-primary/90 backdrop-blur-sm text-primary-foreground font-bold shadow-lg">
                        #{rank}
                      </Badge>
                    )}
                  </div>
                </Link>
              )}
              
              <div className="flex-1 min-w-0 overflow-hidden">
                <Link 
                  to={imageBlurred ? '#' : postUrl} 
                  state={{ from: `/?section=${currentSection}` }} 
                  className="block group mb-1.5" 
                  onClick={(e) => {
                    if (imageBlurred) {
                      handleRestrictedClick(e);
                    } else {
                      sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
                    }
                  }}
                >
                  <h2 className="font-bold text-sm md:text-base lg:text-lg line-clamp-2 break-words" lang="en">
                    {title}
                  </h2>
                </Link>
                
                <div className="flex flex-col gap-1 text-[11px] md:text-xs text-muted-foreground">
                  {communityId && communityName && communitySlug ? (
                    <div className="flex items-center gap-1">
                      <Link 
                        to={`/c/${communitySlug}`}
                        className="flex items-center gap-0.5 font-medium hover:underline shrink-0"
                      >
                        <Avatar className="w-3 h-3">
                          <AvatarImage src={communityIcon} alt={communityName} />
                          <AvatarFallback className="text-[6px]">{communityName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[80px] md:max-w-none">c/{communitySlug}</span>
                      </Link>
                      <span className="shrink-0">· {timeAgo(createdAt)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <Link 
                          to={`/u/${author}`} 
                          className="flex items-center gap-0.5 font-medium hover:underline shrink-0"
                        >
                          <Avatar className="w-3 h-3">
                            <AvatarImage src={authorAvatarUrl} alt={author} />
                            <AvatarFallback className="text-[6px]">{author[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[120px] md:max-w-none">u/{author}</span>
                        </Link>
                        {authorIsVerified && (
                          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center" title={authorVerificationType || 'Official'}>
                            <BadgeCheck className="w-3 h-3 text-primary" />
                          </div>
                        )}
                        {wikiEntryCreatorId && userId === wikiEntryCreatorId && (
                          <div title="Fanz Creator">
                            <Crown className="w-4 h-4 text-[#ff4500]" />
                          </div>
                        )}
                        <span className="shrink-0">· {timeAgo(createdAt)}</span>
                      </div>
                      {wikiEntryTitle && wikiEntrySlug && (
                        <div className="flex items-center gap-1">
                          <span>/ </span>
                          <Link 
                            to={`/k/${wikiEntrySlug}`}
                            className="font-medium hover:underline shrink-0 truncate max-w-[150px] md:max-w-none text-primary"
                          >
                            {wikiEntryTitle}
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
              </div>
            </div>
            
            {/* 내용 */}
            <Link 
              to={imageBlurred ? '#' : postUrl} 
              state={{ from: `/?section=${currentSection}` }} 
              className="block group mt-2 md:mt-3" 
              onClick={(e) => {
                if (imageBlurred) {
                  handleRestrictedClick(e);
                } else {
                  sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
                }
              }}
            >
              <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 break-words overflow-hidden" lang="en">
                {stripHtmlTags(content)}
              </p>
            </Link>
          </div>
          
          {/* 액션 버튼들 - 카드 하단 */}
          <div className="flex items-center justify-between gap-1.5 md:gap-4 mt-3 md:mt-4">
            <div className="flex items-center gap-0.5 md:gap-1 px-2 md:px-2.5 py-1 md:py-1.5 rounded-full bg-muted/50 text-xs">
              <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" />
              <span className="font-semibold">{trendingScore ?? realtimeVotes}</span>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2 ml-auto">
              {/* 보팅 버튼을 우하단으로 이동 */}
              <VoteButtons
                votes={realtimeVotes}
                userVote={userVote}
                onVote={(type) => onVote(id, type)}
                vertical={false}
              />
              
              {isOwnPost && !isBoosted && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setShowBoostDialog(true)}
                  disabled={isProcessing}
                  className="gap-1 h-7 md:h-8 px-2 md:px-3 rounded-full text-xs"
                >
                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden md:inline">Boost</span>
                </Button>
              )}
              
              {isAdmin && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2" disabled={isProcessing}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {isPinned ? (
                      <DropdownMenuItem onSelect={handleUnpinPost} disabled={isProcessing}>
                        <Pin className="w-4 h-4 mr-2" />
                        Unpin Post
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={handlePinPost} disabled={isProcessing}>
                        <Pin className="w-4 h-4 mr-2" />
                        Pin Post
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <BoostPostDialog
            open={showBoostDialog}
            onOpenChange={setShowBoostDialog}
            onConfirm={handleBoostPost}
            hourlyRate={-pointCosts.boostPerHour}
            isProcessing={isProcessing}
          />
          
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Post</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this post? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletePost}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};

export default PostCard;
