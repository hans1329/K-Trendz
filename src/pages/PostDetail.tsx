import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import VoteButtons from "@/components/VoteButtons";
import CommentSection, { CommentSectionRef } from "@/components/CommentSection";
import MentionText from "@/components/MentionText";
import { BoostPostDialog } from "@/components/BoostPostDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ExternalLink, Loader2, Trash2, Edit, Zap, MoreVertical, Share2, Eye, Crown, ImageOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { saveMentionsForComment } from "@/lib/mentions";
import SignupCTA from "@/components/SignupCTA";

interface Comment {
  id: string;
  content: string;
  votes: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_comment_id?: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  replies?: Comment[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string | null;
  votes: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  image_url: string | null;
  visibility: string | null;
  view_count: number;
  trending_score: number;
  is_pinned: boolean | null;
  is_boosted: boolean | null;
  boosted_until: string | null;
  community_id: string | null;
  wiki_entry_id: string | null;
  source_url: string | null;
  slug: string | null;
  event_date: string | null;
  metadata: unknown;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  wiki_entries?: {
    title: string;
    slug: string;
    owner_id?: string | null;
    creator_id?: string | null;
  } | null;
}


const shouldBlurPostImage = (
  visibility: string | null | undefined,
  isFollowing: boolean,
  isAdmin: boolean,
  isPageOwner: boolean,
  isPostAuthor: boolean
): boolean => {
  if (isAdmin || isPageOwner || isPostAuthor) return false;
  if ((visibility || 'public') === 'fans_only') return !isFollowing;
  return false;
};

const getPostBlurReason = (visibility: string | null | undefined): string => {
  if ((visibility || 'public') === 'fans_only') return 'Fans Only';
  return '';
};

const PostDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast: showToast } = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [showBoostDialog, setShowBoostDialog] = useState(false);
  const [isProcessingBoost, setIsProcessingBoost] = useState(false);
  const [boostHourlyRate, setBoostHourlyRate] = useState(-5);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentVotes, setCommentVotes] = useState<Map<string, "up" | "down" | null>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const commentSectionRef = useRef<CommentSectionRef>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPost();
    fetchBoostRate();
  }, [id, slug]);

  // 포스트가 로드된 후 댓글 가져오기
  useEffect(() => {
    if (post?.id) {
      fetchComments(post.id);
    }
  }, [post?.id]);

  // URL 해시가 #comment인 경우 댓글 입력창으로 스크롤 및 포커스
  useEffect(() => {
    if (location.hash === '#comment' && commentSectionRef.current) {
      setTimeout(() => {
        commentSectionRef.current?.focusInput();
      }, 300);
    }
  }, [location.hash, comments]);

  // TikTok embed script 로드
  useEffect(() => {
    if (post && post.content.includes('tiktok-embed')) {
      if (!document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.tiktok.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // 스크립트가 이미 있다면 재실행
        if ((window as any).tiktok) {
          (window as any).tiktok.embed.init();
        }
      }
    }
  }, [post]);

  const fetchBoostRate = async () => {
    try {
      const { data } = await supabase
        .from('point_rules')
        .select('points')
        .eq('action_type', 'boost_post_per_hour')
        .eq('is_active', true)
        .single();
      
      if (data) {
        setBoostHourlyRate(data.points);
      }
    } catch (error) {
      console.error('Error fetching boost rate:', error);
    }
  };

  const fetchPost = async () => {
    // slug나 id 둘 중 하나로 조회
    const identifier = slug || id;
    if (!identifier) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // slug로 조회 (slug가 있으면 slug로, 없으면 id로)
      const baseQuery = () =>
        supabase
          .from("posts")
          .select(`
            *,
            profiles:user_id (username, display_name, avatar_url),
            wiki_entries:wiki_entry_id (id, title, slug, creator_id, owner_id)
          `);

      // /p/:slug 경로일 경우
      if (slug) {
        // 1) slug로 먼저 시도
        const { data: slugData, error: slugError } = await baseQuery()
          .eq("slug", slug)
          .maybeSingle();

        if (!slugError && slugData) {
          processPostData(slugData, user);
          return;
        }

        // 2) 레거시 지원: /p/{uuid} 형태로 들어온 경우 id로 조회 후 올바른 slug로 이동
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(slug)) {
          const { data: idData, error: idError } = await baseQuery()
            .eq("id", slug)
            .maybeSingle();

          if (!idError && idData) {
            if (idData.slug && idData.slug !== slug) {
              navigate(`/p/${idData.slug}`, { replace: true });
              return;
            }
            processPostData(idData, user);
            return;
          }
        }

        // 3) slug 앞 8자리(abc12345-) 기반으로 검색 (공유/복사 중 일부가 달라져도 복구)
        const shortId = slug.substring(0, 8);
        const { data: prefixData, error: prefixError } = await baseQuery()
          .like("slug", `${shortId}%`)
          .limit(1)
          .maybeSingle();

        if (!prefixError && prefixData) {
          if (prefixData.slug && prefixData.slug !== slug) {
            navigate(`/p/${prefixData.slug}`, { replace: true });
            return;
          }
          processPostData(prefixData, user);
          return;
        }
      } else if (id) {
        // 기존 id 기반 조회 (후방 호환성)
        const { data, error } = await baseQuery().eq("id", id).maybeSingle();

        if (error) throw error;

        if (data) {
          // slug가 있으면 새 URL로 리다이렉트
          if (data.slug) {
            navigate(`/p/${data.slug}`, { replace: true });
            return;
          }
          processPostData(data, user);
          return;
        }
      }

      showToast({
        title: "Post not found",
        description: "The post you're looking for doesn't exist",
        variant: "destructive",
      });
      navigate("/");
    } catch (error) {
      console.error("Error fetching post:", error);
      showToast({
        title: "Error",
        description: "Failed to load post",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const processPostData = async (data: any, currentUser: any) => {
    setPost(data);

    // 연관 포스트 가져오기
    await fetchRelatedPosts(data);

    // 조회수 증가 (본인 포스트가 아닐 때만)
    if (!currentUser || currentUser.id !== data.user_id) {
      const { error: viewError } = await supabase.rpc('increment_post_view_count', {
        post_id_param: data.id
      });
      
      if (!viewError) {
        setPost(prev => prev ? { 
          ...prev, 
          view_count: (prev.view_count || 0) + 1 
        } : prev);
      }
    }

    // 사용자의 투표 정보 가져오기
    if (currentUser) {
      const { data: voteData } = await supabase
        .from('post_votes')
        .select('vote_type')
        .eq('post_id', data.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (voteData) {
        setUserVote(voteData.vote_type);
      }

      // 팔로잉 상태 체크 (wiki_entry가 있는 경우)
      if (data.wiki_entry_id) {
        const { data: followData } = await supabase
          .from('wiki_entry_followers')
          .select('id')
          .eq('wiki_entry_id', data.wiki_entry_id)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        setIsFollowing(!!followData);

      }
    }
    setLoading(false);
  };

  // 연관 포스트 가져오기
  const fetchRelatedPosts = async (currentPost: Post) => {
    const postId = currentPost.id;
    if (!postId) return;

    try {
      let query = supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url),
          wiki_entries:wiki_entry_id (id, title, slug, creator_id)
        `)
        .neq("id", postId)
        .order("created_at", { ascending: false })
        .limit(4);

      // 같은 wiki_entry_id를 가진 포스트 우선
      if (currentPost.wiki_entry_id) {
        const { data: sameWikiPosts } = await supabase
          .from("posts")
          .select(`
            *,
            profiles:user_id (username, display_name, avatar_url),
            wiki_entries:wiki_entry_id (id, title, slug, creator_id)
          `)
          .eq("wiki_entry_id", currentPost.wiki_entry_id)
          .neq("id", postId)
          .order("created_at", { ascending: false })
          .limit(4);

        if (sameWikiPosts && sameWikiPosts.length > 0) {
          setRelatedPosts(sameWikiPosts);
          return;
        }
      }

      // wiki_entry_id가 없거나 관련 포스트가 없으면 같은 카테고리
      const { data: sameCategoryPosts } = await query.eq("category", currentPost.category);
      
      if (sameCategoryPosts && sameCategoryPosts.length > 0) {
        setRelatedPosts(sameCategoryPosts);
      } else {
        // 카테고리도 같은게 없으면 최신 포스트
        const { data: latestPosts } = await query;
        setRelatedPosts(latestPosts || []);
      }
    } catch (error) {
      console.error("Error fetching related posts:", error);
    }
  };

  const fetchComments = async (postId?: string) => {
    const targetPostId = postId || post?.id;
    if (!targetPostId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: commentsData, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", targetPostId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles separately
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.id, p]) || []
        );

        const enrichedComments = commentsData.map(comment => ({
          ...comment,
          profiles: profilesMap.get(comment.user_id) || null
        }));

        // 사용자의 댓글 투표 정보 가져오기
        if (user) {
          const commentIds = commentsData.map(c => c.id);
          const { data: voteData } = await supabase
            .from('comment_votes')
            .select('comment_id, vote_type')
            .in('comment_id', commentIds)
            .eq('user_id', user.id);

          const votesMap = new Map<string, "up" | "down" | null>();
          voteData?.forEach(vote => {
            votesMap.set(vote.comment_id, vote.vote_type);
          });
          setCommentVotes(votesMap);
        }

        // 댓글을 트리 구조로 변환
        const commentsMap = new Map<string, Comment>();
        const topLevelComments: Comment[] = [];

        enrichedComments.forEach(comment => {
          commentsMap.set(comment.id, { ...comment, replies: [] });
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

        setComments(topLevelComments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  // 팬 레벨 기반 투표 가중치 계산 (React Query 캐시 활용)
  const getVoteWeight = (wikiEntryId: string | undefined, userId: string): number => {
    if (!wikiEntryId || !userId) return 1;
    
    try {
      // React Query 캐시에서 온체인 잔액 가져오기 (MyFanStatusCard에서 이미 조회됨)
      // fanz_token 캐시 조회
      const fanzTokenCache = queryClient.getQueryData<{ token_id: string }>(['fanz-token', wikiEntryId]);
      if (!fanzTokenCache?.token_id) return 1;
      
      // 사용자 지갑 캐시 조회
      const userWalletCache = queryClient.getQueryData<string>(['user-wallet', userId]);
      if (!userWalletCache) return 1;
      
      // 온체인 잔액 캐시 조회
      const balanceCache = queryClient.getQueryData<number>(['user-fanz-balance', fanzTokenCache.token_id, userWalletCache]);
      const holdingCount = balanceCache || 0;
      
      // 팬 랭킹 기반 가중치:
      // Diamond Fan (100+): 5배
      // Gold Fan (50+): 4배
      // Silver Fan (20+): 3배
      // Bronze Fan (5+): 2배
      // Lightstick Holder (1+): 1.5배
      // Follower/Visitor: 1배
      if (holdingCount >= 100) return 5;
      if (holdingCount >= 50) return 4;
      if (holdingCount >= 20) return 3;
      if (holdingCount >= 5) return 2;
      if (holdingCount >= 1) return 1.5;
      return 1;
    } catch (error) {
      console.error('Error calculating vote weight:', error);
      return 1;
    }
  };

  const handleVote = async (type: "up" | "down") => {
    if (!post || !user) {
      showToast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive",
      });
      return;
    }

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = userVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const previewNewVote = isUnvoting ? null : type;
    const isVoteSwitch = userVote !== null && previewNewVote !== null && userVote !== previewNewVote;
    console.log('[Vote] Clicked', { type, userVote, isUnvoting, isVoteSwitch, postId: post.id });
    
    // 응원봉 보유량에 따른 가중치 계산 (캐시 활용)
    const voteWeight = getVoteWeight((post as any).wiki_entry_id, user.id);
    console.log('[Vote] Weight calculated:', voteWeight);
    
    // 새 투표만 에너지 체크 (취소나 전환은 제외)
    if (!isUnvoting && !isVoteSwitch) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const { data: voteCheck, error: checkError } = await supabase
          .rpc('check_and_increment_vote_count', { 
            user_id_param: user.id,
            target_id_param: post.id,
            target_type_param: 'post'
          });

        console.log('[Vote] check_and_increment_vote_count result', { voteCheck, checkError });

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as { 
          can_vote: boolean; 
          max_votes: number; 
          remaining_votes: number; 
          current_level: number;
          completion_rewarded?: boolean;
          is_first_vote_today: boolean;
        };
        console.log('[Vote] Parsed checkData', checkData);

        if (!checkData?.is_first_vote_today) {
          console.log('[Vote] Already voted on this post today');
          showToast({
            title: "Already voted today",
            description: "You can only vote once per post per day.",
            variant: "destructive",
          });
          return;
        }

        if (!checkData.can_vote) {
          console.log('[Vote] Daily limit reached, blocking vote');
          showToast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive",
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          console.log('[Vote] Daily energy completed, triggering bonus + token flow');
          showToast({
            title: "🎉 Daily Energy Completed!",
            description: `Bonus points awarded for using all ${checkData.max_votes} energy today!`,
          });
          
          // 토큰 민팅 시작 알림 - 즉시 표시
          console.log('[Vote] Showing Reward Token Minting toast');
          showToast({
            title: "Reward Token Minting...",
            description: "Processing your daily KTNZ token reward",
          });
          
          // 데일리 토큰 민팅 (1.5초 후 시작)
          setTimeout(async () => {
            try {
              console.log('[Vote] Calling mint-daily-tokens edge function');
              const { data: mintData, error: mintError } = await supabase.functions.invoke('mint-daily-tokens');
              console.log('[Vote] mint-daily-tokens result', { mintData, mintError });
              
              if (mintError) {
                console.error('Token mint error:', mintError);
                const errorData = mintError as any;
                
                if (errorData.needsWallet || errorData.message?.includes('wallet')) {
                  showToast({
                    title: "Wallet Required",
                    description: "Please create a wallet first to claim daily tokens",
                    action: (
                      <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
                        Create Wallet
                      </Button>
                    ),
                  });
                }
              } else if (mintData?.success) {
                showToast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`,
                });
              }
            } catch (error) {
              console.error('Failed to mint daily tokens:', error);
            }
          }, 1500);
        } else {
          showToast({
            title: "Vote counted",
            description: `Energy ${checkData.max_votes - checkData.remaining_votes}/${checkData.max_votes} used today`,
          });
        }
        
        // Navbar 업데이트 트리거
        window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
      } catch (error) {
        console.error("Error checking vote count:", error);
        showToast({
          title: "Vote check failed",
          description: "Failed to check daily vote limit",
          variant: "destructive",
        });
        return;
      }
    }

    const oldUserVote = userVote;
    let newUserVote: "up" | "down" | null = type;
    let voteDelta = 0;

    // 응원봉 보유자 가중치 적용 (upvote에만 적용)
    const weightedScore = type === "up" ? Math.round(voteWeight) : 1;

    if (userVote === type) {
      // 같은 버튼 클릭: 투표 취소 - 이전 가중치 적용된 점수 복원
      newUserVote = null;
      voteDelta = type === "up" ? -weightedScore : 1;
    } else if (userVote) {
      // 다른 버튼 클릭: 투표 변경
      // up→down: 이전 가중치 점수 제거 + 1점 감소
      // down→up: 1점 복원 + 가중치 점수 추가
      voteDelta = type === "up" ? (1 + weightedScore) : -(weightedScore + 1);
    } else {
      // 새 투표
      voteDelta = type === "up" ? weightedScore : -1;
    }
    
    console.log('[Vote] Delta calculated with weight:', { voteDelta, weightedScore, voteWeight });

    // Optimistic update
    setUserVote(newUserVote);
    setPost({
      ...post,
      votes: post.votes + voteDelta,
    });

    try {
      // Post 투표 처리
      if (newUserVote === null) {
        // 투표 삭제
        const { error } = await supabase
          .from('post_votes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표 생성
        const { error } = await supabase
          .from('post_votes')
          .insert({
            post_id: post.id,
            user_id: user.id,
            vote_type: newUserVote
          });

        if (error) throw error;
      } else {
        // 투표 변경
        const { error } = await supabase
          .from('post_votes')
          .update({ vote_type: newUserVote })
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // Wiki entry와 연결된 post인 경우 wiki entry 투표도 함께 처리
      if ((post as any).wiki_entry_id) {
        const wikiEntryId = (post as any).wiki_entry_id;
        const today = new Date().toISOString().split('T')[0];
        
        if (newUserVote === null) {
          // Wiki entry 투표 삭제 (오늘 날짜 기준)
          await supabase
            .from('wiki_entry_votes')
            .delete()
            .eq('wiki_entry_id', wikiEntryId)
            .eq('user_id', user.id)
            .eq('vote_date', today);
        } else if (oldUserVote === null) {
          // 새 wiki entry 투표 생성 (오늘 날짜)
          await supabase
            .from('wiki_entry_votes')
            .insert({
              wiki_entry_id: wikiEntryId,
              user_id: user.id,
              vote_type: newUserVote,
              vote_date: today
            });
        } else {
          // Wiki entry 투표 변경 (오늘 날짜 기준)
          await supabase
            .from('wiki_entry_votes')
            .update({ vote_type: newUserVote })
            .eq('wiki_entry_id', wikiEntryId)
            .eq('user_id', user.id)
            .eq('vote_date', today);
        }

        // 온체인 투표 기록 (upvote인 경우만, 관리자 제외)
        if (newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin) {
          try {
            // wiki entry 타이틀 가져오기
            const { data: entryData } = await supabase
              .from('wiki_entries')
              .select('title')
              .eq('id', wikiEntryId)
              .single();
            
            const entryTitle = entryData?.title || post.title || 'Unknown Entry';
            
            const { data: onchainResult } = await supabase.functions.invoke('record-onchain-vote', {
              body: {
                eventId: null,
                oderId: null,
                voterAddressOrUserId: user.id,
                artistName: entryTitle,
                inviteCode: '',
                voteCount: 1
              }
            });
            console.log('[PostDetail] On-chain vote recorded for entry:', entryTitle, onchainResult);
            
            // tx_hash를 wiki_entry_votes에 저장
            if (onchainResult?.txHash) {
              await supabase
                .from('wiki_entry_votes')
                .update({ tx_hash: onchainResult.txHash })
                .eq('wiki_entry_id', wikiEntryId)
                .eq('user_id', user.id)
                .eq('vote_date', today);
            }
          } catch (onchainError) {
            console.error('[PostDetail] On-chain vote recording failed:', onchainError);
          }
        }
      }

      // Navbar 일일 에너지 표시 갱신
      window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
    } catch (error) {
      console.error("Error voting:", error);
      showToast({
        title: "Vote failed",
        description: "Failed to vote",
        variant: "destructive",
      });
      // Revert optimistic update
      setUserVote(oldUserVote);
      setPost({
        ...post,
        votes: post.votes,
      });
    }
  };

  const handleShare = async () => {
    // slug가 있으면 /p/slug 형식, 없으면 /post/id 형식 사용
    const shareUrl = post?.slug 
      ? `https://k-trendz.com/p/${post.slug}`
      : `https://k-trendz.com/post/${id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast({
        title: "Link copied!",
        description: "Post link copied to clipboard",
      });
    } catch (error) {
      // Fallback: 텍스트 선택 방식
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast({
          title: "Link copied!",
          description: "Post link copied to clipboard",
        });
      } catch (err) {
        showToast({
          title: "Copy failed",
          description: "Failed to copy link",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDeletePost = async () => {
    if (!post || !user) return;

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      showToast({
        title: "Post deleted",
        description: "Your post has been deleted",
      });
      
      // 엔트리의 팬 포스트 목록 캐시 무효화
      if (post.wiki_entry_id) {
        queryClient.invalidateQueries({ queryKey: ['fanPosts', post.wiki_entry_id] });
        queryClient.invalidateQueries({ queryKey: ['fan-posts-count', post.wiki_entry_id] });
      }
      
      // wiki entry가 있으면 해당 엔트리로, 없으면 이전 페이지로
      if (post.wiki_entries?.slug) {
        navigate(`/k/${post.wiki_entries.slug}`);
      } else {
        navigate(-1);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showToast({
        title: "Delete failed",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (content: string, parentCommentId?: string) => {
    if (!user || !id) {
      toast.error("Please login to comment");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: id,
          user_id: user.id,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // 멘션 저장
        await saveMentionsForComment(data.id, content, user.id);

        // 댓글 목록 새로고침
        await fetchComments();
        toast.success("Comment added");
      }
    } catch (error: any) {
      console.error("Error adding comment:", error);
      const isInsufficientPoints = error?.message?.includes('Insufficient points');
      toast.error(isInsufficientPoints ? "You don't have enough Stars to write a comment" : "Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      // 댓글 목록 새로고침 (대댓글도 함께 삭제됨)
      await fetchComments();
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleVoteComment = async (commentId: string, type: "up" | "down") => {
    if (!user) {
      toast.error("Please login to vote");
      return;
    }

    try {
      // Database function을 사용하여 투표 처리
      const { error } = await supabase.rpc('handle_comment_vote', {
        comment_id_param: commentId,
        user_id_param: user.id,
        vote_type_param: type
      });

      if (error) throw error;

      // 성공 후 댓글 목록 새로고침
      await fetchComments();
    } catch (error) {
      console.error("Error voting comment:", error);
      toast.error("Failed to vote");
    }
  };

  const handleBoostPost = async (hours: number) => {
    if (!post || !user) return;

    setIsProcessingBoost(true);
    try {
      const { error } = await supabase.rpc('boost_post', {
        post_id_param: post.id,
        duration_hours: hours,
      });

      if (error) throw error;

      toast.success(`Post boosted for ${hours} hours!`);
      setShowBoostDialog(false);
      
      // Refresh post to get updated boost status
      await fetchPost();
    } catch (error: any) {
      console.error('Error boosting post:', error);
      toast.error(error.message || 'Failed to boost post');
    } finally {
      setIsProcessingBoost(false);
    }
  };

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
    
    return "just now";
  };

  // HTML 엔티티 디코딩 함수
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    return text.replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
  };

  // 커버 이미지가 없으면 본문의 첫 이미지 추출
  const getDisplayImage = (): string | null => {
    if (post?.image_url) return post.image_url;
    if (!post?.content) return null;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    const firstImg = tempDiv.querySelector('img');
    return firstImg?.src || null;
  };

  const displayImage = getDisplayImage();

  const isMobile = useIsMobile();
  
  if (loading) {
    return (
      <V2Layout pcHeaderTitle="Post" showBackButton>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </V2Layout>
    );
  }

  if (!post) {
    return null;
  }

  // 메타 정보 준비
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  
  const pageTitle = `${post.title} | KTRENDZ`;
  const pageDescription = stripHtml(post.content).substring(0, 160);
  const pageImage = post.image_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png';
  const pageUrl = `https://k-trendz.com/post/${id}`;

  return (
    <>
      <Helmet>
        {/* 기본 메타 태그 */}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={pageUrl} />
        
        {/* Open Graph 태그 (Facebook, LinkedIn 등) */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="KTRENDZ" />
        <meta property="article:published_time" content={post.created_at} />
        <meta property="article:author" content={post.profiles?.display_name || post.profiles?.username || "Anonymous"} />
        
        {/* Twitter 카드 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageImage} />
        
        {/* 구조화된 데이터 (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": pageDescription,
            "image": pageImage,
            "datePublished": post.created_at,
            "author": {
              "@type": "Person",
              "name": post.profiles?.display_name || post.profiles?.username || "Anonymous"
            },
            "publisher": {
              "@type": "Organization",
              "name": "KTRENDZ",
              "logo": {
                "@type": "ImageObject",
                "url": "https://k-trendz.com/logo.png"
              }
            }
          })}
        </script>
      </Helmet>
      
      <V2Layout pcHeaderTitle={post.wiki_entries?.title || "Post"} showBackButton>
        <div className={`${isMobile ? 'px-4' : ''} py-6`}>
        <div className="flex items-center justify-between mb-4">
          {isAdmin && post.trending_score !== undefined && (
            <Badge className="text-sm px-3 py-1 bg-[#ff4500] text-white font-semibold">
              Score: {post.trending_score}
            </Badge>
          )}
        </div>

        <div className="p-4 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {post.wiki_entries && (
                  <>
                  <button
                    onClick={() => navigate(`/k/${post.wiki_entries!.slug}`)}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                      {post.wiki_entries.title}
                    </button>
                    <span className="text-sm text-muted-foreground">·</span>
                  </>
                )}
                <Avatar className="w-8 h-8">
                  <AvatarImage src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} />
                  <AvatarFallback>{(post.profiles?.username || "A")[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => navigate(`/u/${post.profiles?.username}`)}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {post.profiles?.display_name || post.profiles?.username || "Anonymous"}
                </button>
                {post.wiki_entries?.creator_id && post.user_id === post.wiki_entries.creator_id && (
                  <div title="Fanz Creator">
                    <Crown className="w-4 h-4 text-[#ff4500]" />
                  </div>
                )}
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{timeAgo(post.created_at)}</span>
              </div>
            </div>
            
            {user && (user.id === post.user_id || isAdmin) && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="z-50"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem 
                    onSelect={() => navigate(`/edit/${post.id}`)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Post
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold mb-4" translate="yes" lang="en">{post.title}</h1>
          
          <div className="mb-4 rounded-lg overflow-hidden -mx-4 sm:mx-0">
            {displayImage ? (() => {
              const isPageOwner = user?.id === post.wiki_entries?.owner_id || user?.id === post.wiki_entries?.creator_id;
              const isPostAuthor = user?.id === post.user_id;
              const imageBlurred = shouldBlurPostImage(
                post.visibility,
                isFollowing,
                isAdmin,
                isPageOwner,
                isPostAuthor
              );

              if (imageBlurred) {
                const blurReason = getPostBlurReason(post.visibility);
                return (
                  <div className="relative w-full max-h-[400px] sm:max-h-[500px] aspect-video bg-muted">
                    <img 
                      src={decodeHtmlEntities(displayImage)} 
                      alt={post.title}
                      className="w-full h-full object-contain blur-xl brightness-50"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <Lock className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">{blurReason}</span>
                    </div>
                  </div>
                );
              }

              return (
                <img 
                  src={decodeHtmlEntities(displayImage)} 
                  alt={post.title}
                  className="w-full max-h-[400px] sm:max-h-[500px] object-contain bg-muted"
                  loading="lazy"
                />
              );
            })() : (
              <div className="w-full h-64 flex items-center justify-center bg-muted">
                <ImageOff className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <article 
            className="prose prose-sm sm:prose-base max-w-none mb-4
              text-foreground
              [&_*]:!bg-transparent
              [&_img]:max-w-full [&_img]:h-auto [&_img]:block [&_img]:my-4 [&_img]:rounded-lg [&_img]:shadow-md [&_img]:!bg-muted
              [&_.mention]:text-primary [&_.mention]:font-medium [&_.mention]:no-underline
              [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-foreground [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2
              [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-foreground
              [&_h3]:text-lg sm:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground
              [&_h4]:text-base sm:[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h4]:text-foreground
              [&_p]:text-sm sm:[&_p]:text-base [&_p]:leading-relaxed [&_p]:my-3 [&_p]:text-foreground
              [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-3 [&_ul]:space-y-1
              [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-3 [&_ol]:space-y-1
              [&_li]:text-sm sm:[&_li]:text-base [&_li]:leading-relaxed [&_li]:text-foreground
              [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/50 hover:[&_a]:decoration-primary
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:!bg-muted/50 [&_blockquote]:rounded-r
              [&_code]:!bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
              [&_pre]:!bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4
              [&_pre_code]:!bg-transparent [&_pre_code]:p-0
              [&_strong]:font-bold [&_strong]:text-foreground
              [&_em]:italic
              [&_hr]:my-6 [&_hr]:border-border
              [&_.tiktok-embed-container]:my-6 [&_.tiktok-embed-container]:mx-auto [&_.tiktok-embed]:border-0"
            translate="yes"
            lang="en"
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {post.source_url && (
            <a 
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              View Original Source
            </a>
          )}
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-6">
            <div className="flex items-center gap-4">
              <VoteButtons
                votes={post.votes}
                userVote={userVote}
                onVote={handleVote}
                vertical={false}
              />
              
              {post.view_count !== undefined && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  <span>{post.view_count}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                className="gap-2 flex-1 sm:flex-initial rounded-full border-0"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              {user && user.id === post.user_id && !post.is_boosted && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBoostDialog(true)}
                  className="gap-2 flex-1 sm:flex-initial rounded-full border-0 hover:bg-primary hover:text-primary-foreground group"
                >
                  <Zap className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
                  <span className="hidden sm:inline">Boost Post</span>
                  <span className="sm:hidden">Boost</span>
                </Button>
              )}
              {post.is_boosted && post.boosted_until && (
                <Badge variant="default" className="gap-1 flex-1 sm:flex-initial justify-center py-2">
                  <Zap className="w-3 h-3" />
                  <span className="hidden sm:inline">Boosted until {new Date(post.boosted_until).toLocaleString('en-US')}</span>
                  <span className="sm:hidden">Boosted</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <CommentSection
            ref={commentSectionRef}
            comments={comments}
            currentUserId={user?.id}
            postAuthorId={post?.user_id}
            wikiCreatorId={post?.wiki_entries?.creator_id}
            commentVotes={commentVotes}
            onAddComment={handleAddComment}
            onVoteComment={handleVoteComment}
            onDeleteComment={handleDeleteComment}
          />
        </div>

        {/* Related Posts Section */}
        {relatedPosts.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-4">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedPosts.map((relatedPost) => {
                const relatedDisplayImage = relatedPost.image_url || (() => {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = relatedPost.content;
                  const firstImg = tempDiv.querySelector('img');
                  return firstImg?.src || null;
                })();

                return (
                  <div 
                    key={relatedPost.id}
                    className="group cursor-pointer hover:bg-muted/30 transition-colors p-4 rounded-lg"
                    onClick={() => navigate(`/post/${relatedPost.id}`)}
                  >
                    <div className="flex gap-3">
                      {relatedDisplayImage && (
                        <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          <img 
                            src={relatedDisplayImage}
                            alt={relatedPost.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                          {relatedPost.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          {relatedPost.wiki_entries && (
                            <>
                              <span className="text-primary font-medium">
                                {relatedPost.wiki_entries.title}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span>{relatedPost.profiles?.display_name || relatedPost.profiles?.username}</span>
                          <span>·</span>
                          <span>{timeAgo(relatedPost.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            👍 {relatedPost.votes}
                          </span>
                          {relatedPost.view_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {relatedPost.view_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <BoostPostDialog
          open={showBoostDialog}
          onOpenChange={setShowBoostDialog}
          onConfirm={handleBoostPost}
          hourlyRate={boostHourlyRate}
          isProcessing={isProcessingBoost}
        />

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Post</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this post? This will also delete all comments. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePost}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
        
        {/* Signup CTA for logged out users */}
        {!user && (
          <div className="mx-4 sm:mx-8 mb-8">
            <SignupCTA />
          </div>
        )}
      </V2Layout>
    </>
  );
};

export default PostDetail;
