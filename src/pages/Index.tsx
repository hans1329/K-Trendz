import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import VoteButtons from "@/components/VoteButtons";
import { BoostPostDialog } from "@/components/BoostPostDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { TrendingUp, Flame, Star, MessageSquare, Search, UtensilsCrossed, Camera, Plane, Utensils, Sparkles, Calendar, ChevronDown, BookOpen, User, Trash2, Pin, Zap, MoreVertical, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import WikiImageCard from "@/components/WikiImageCard";
import { toast as sonnerToast } from "sonner";

import liveTrendzLogo from "@/assets/live-trendz.webp";
interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  votes: number;
  commentCount: number;
  createdAt: Date;
  userVote?: "up" | "down" | null;
  authorIsVerified?: boolean;
  authorVerificationType?: string;
  imageUrl?: string;
  sourceUrl?: string;
  user_id?: string;
  communityId?: string;
  communityName?: string;
  communitySlug?: string;
  communityIcon?: string;
  authorAvatarUrl?: string;
  isPinned?: boolean;
  isBoosted?: boolean;
  boostedUntil?: string;
  wikiEntryTitle?: string;
  wikiEntryId?: string;
  wikiEntrySlug?: string;
  wikiEntryCreatorId?: string;
  trendingScore?: number;
  metadata?: { image_visibility?: 'private' | 'followers' | 'token_holders' | 'scheduled'; min_token_holdings?: number } | null;
  eventDate?: string | null;
  slug?: string;
}

const samplePosts: Post[] = [{
  id: "1",
  title: "BTS Jungkook's Solo Album 'GOLDEN' Hits #1 on Billboard 200!",
  content: "Jungkook's solo album 'GOLDEN' has topped the Billboard 200 chart. The title track 'Standing Next to You' also debuted at #5 on the HOT 100, setting a new record for K-Pop solo artists.",
  author: "kpop_news_bot",
  category: "News",
  votes: 342,
  commentCount: 89,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  userVote: null,
  imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80"
}, {
  id: "2",
  title: "NewJeans 'OMG' Music Video Surpasses 500M Views!",
  content: "NewJeans' 'OMG' music video has hit 500 million views just 10 months after release. This is the fastest record for a K-Pop girl group!",
  author: "bunnies_unite",
  category: "News",
  votes: 215,
  commentCount: 47,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  userVote: null,
  imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80"
}, {
  id: "3",
  title: "BLACKPINK World Tour Seoul Concert Review",
  content: "Attended BLACKPINK's concert at Jamsil yesterday and it was absolutely incredible... Jisoo's solo stage brought me to tears ㅠㅠ The setlist was perfect and the 'Pink Venom' performance was pure chills. If you can, definitely go see them live!",
  author: "blink_forever",
  category: "Discussion",
  votes: 428,
  commentCount: 156,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
  userVote: null,
  imageUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=80"
}, {
  id: "4",
  title: "[Fan Art] Painted SEVENTEEN Seungkwan in Watercolor 💎",
  content: "First time creating K-Pop idol fan art! How does it look? Feedback welcome! (Image upload feature coming soon)",
  author: "art_carat",
  category: "Fan Content",
  votes: 167,
  commentCount: 34,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  userVote: null,
  imageUrl: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80"
}, {
  id: "5",
  title: "This Week's Music Show #1 Prediction Thread",
  content: "Based on Melon 24-hour charts, it's a close race between IU vs IVE. What do you all think? Personally, I think IU has the album points advantage...",
  author: "chart_master",
  category: "Charts & Stats",
  votes: 93,
  commentCount: 78,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 15),
  userVote: null,
  imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80"
}, {
  id: "6",
  title: "New to K-Pop, Need Recommendations!",
  content: "Recently got into K-Pop after listening to 'Seven' and 'Super Shy'. Looking for similar vibes or artist recommendations! I love upbeat songs!",
  author: "newbie_fan",
  category: "Question",
  votes: 45,
  commentCount: 67,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
  userVote: null
}];

const entertainmentCategories = ["All", "News", "Rumors", "Discussions", "Original Content", "Dramas", "OP-ED", "Videos", "Photos", "KTrendz Wiki"];
const cultureCategories = ["All", "News", "Travel", "Food", "Fashion/Beauty", "Events"];

const Index = () => {
  const isMobile = useIsMobile();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInHeader, setShowSearchInHeader] = useState(false);
  const [sortBy, setSortBy] = useState<"best" | "new" | "hot" | "top">("best");
  const [filterBy, setFilterBy] = useState<"all" | "myfan">("all");
  const [user, setUser] = useState<any>(null);
  const [wikiBoostDialogs, setWikiBoostDialogs] = useState<Record<string, boolean>>({});
  const [wikiProcessing, setWikiProcessing] = useState<Record<string, boolean>>({});
  const [previousRankings, setPreviousRankings] = useState<Record<string, number>>({});
  const [rankingsLoaded, setRankingsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [wikiRankingSnapshot, setWikiRankingSnapshot] = useState<string | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allWikiActivities, setAllWikiActivities] = useState<any[]>([]);
  const [deleteHistoryId, setDeleteHistoryId] = useState<string | null>(null);
  const scrollPositionRef = useRef<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") || "all";
  const { isAdmin, user: authUser } = useAuth();
  
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

  // 위키 엔트리의 표시 이미지 가져오기 (업로드 이미지 우선)
  const getWikiDisplayImage = (wikiEntry: any) => {
    // 업로드 이미지 우선
    if (wikiEntry.image_url && wikiEntry.image_url.trim()) return wikiEntry.image_url;
    
    // metadata의 이미지들
    if (wikiEntry.metadata?.profile_image && wikiEntry.metadata.profile_image.trim()) {
      return wikiEntry.metadata.profile_image;
    }
    if (wikiEntry.metadata?.album_cover && wikiEntry.metadata.album_cover.trim()) {
      return wikiEntry.metadata.album_cover;
    }
    
    return null;
  };
  
  const categories = section === "culture" ? cultureCategories : entertainmentCategories;

  const pageSize = 100;
  
  // React Query로 포스트 데이터 가져오기
  const { data: posts = [], isLoading: loading } = useQuery({
    queryKey: ['posts', section, currentPage, filterBy],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 만료된 boosted 포스트 처리
      await supabase.rpc('expire_boosted_posts');
      
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type
          ),
          communities:community_id (
            id,
            name,
            slug,
            icon_url
          ),
          wiki_entries:wiki_entry_id (
            title,
            slug,
            creator_id
          )
        `)
        .eq('is_approved', true);
      
      // My Fan 필터 적용
      if (filterBy === 'myfan' && user) {
        // 내가 팔로우하는 wiki_entry_id 가져오기
        const { data: followedEntries } = await supabase
          .from('wiki_entry_followers')
          .select('wiki_entry_id')
          .eq('user_id', user.id);
        
        if (followedEntries && followedEntries.length > 0) {
          const followedIds = followedEntries.map(f => f.wiki_entry_id);
          query = query.in('wiki_entry_id', followedIds);
        } else {
          // 팔로우하는 엔트리가 없으면 빈 결과 반환
          return [];
        }
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        let userVotes: any[] = [];
        if (user) {
          const { data: votesData } = await supabase
            .from('post_votes')
            .select('post_id, vote_type')
            .eq('user_id', user.id);
          userVotes = votesData || [];
        }

        const postIds = data.map(post => post.id);
        const { data: commentCounts } = await supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds);

        const commentCountMap = new Map<string, number>();
        commentCounts?.forEach(comment => {
          const count = commentCountMap.get(comment.post_id) || 0;
          commentCountMap.set(comment.post_id, count + 1);
        });

        const formattedPosts: Post[] = data.map((post: any) => {
          const userVote = userVotes.find(v => v.post_id === post.id);
          return {
            id: post.id,
            title: post.title,
            content: post.content,
            author: post.profiles?.display_name || post.profiles?.username || 'Unknown',
            category: post.category,
            votes: post.votes || 0,
            commentCount: commentCountMap.get(post.id) || 0,
            createdAt: new Date(post.created_at),
            userVote: userVote ? userVote.vote_type : null,
            imageUrl: post.image_url,
            sourceUrl: post.source_url,
            user_id: post.user_id,
            communityId: post.community_id,
            communityName: post.communities?.name,
            communitySlug: post.communities?.slug,
            communityIcon: post.communities?.icon_url,
            authorAvatarUrl: post.profiles?.avatar_url,
            authorIsVerified: post.profiles?.is_verified,
            authorVerificationType: post.profiles?.verification_type,
            isPinned: post.is_pinned,
            isBoosted: post.is_boosted,
            boostedUntil: post.boosted_until,
            wikiEntryTitle: post.wiki_entries?.title,
            wikiEntryId: post.wiki_entry_id,
            wikiEntrySlug: post.wiki_entries?.slug,
            wikiEntryCreatorId: post.wiki_entries?.creator_id,
            trendingScore: post.trending_score || 0,
            metadata: post.metadata,
            eventDate: post.event_date,
            slug: post.slug,
          };
        });
        
        return formattedPosts;
      }
      
      return [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: section !== "wiki",
  });

  // 페이지가 로드될 때마다 allPosts 업데이트
  useEffect(() => {
    console.log('Posts updated, length:', posts.length, 'currentPage:', currentPage);
    if (posts.length > 0) {
      setAllPosts(prev => {
        // 중복 제거하면서 추가
        const newPosts = posts.filter(post => !prev.some(p => p.id === post.id));
        console.log('Adding new posts:', newPosts.length, 'total will be:', prev.length + newPosts.length);
        return [...prev, ...newPosts];
      });
    }
  }, [posts, currentPage]);

  // 데이터 로딩이 완료되면 스크롤 위치 복원
  useEffect(() => {
    if (!loading && scrollPositionRef.current !== null) {
      console.log('Restoring scroll to:', scrollPositionRef.current);
      setTimeout(() => {
        if (scrollPositionRef.current !== null) {
          window.scrollTo(0, scrollPositionRef.current);
          scrollPositionRef.current = null;
        }
      }, 100);
    }
  }, [loading]);


  // section이나 sortBy, filterBy가 변경되면 페이지, 누적 데이터, 순위 스냅샷 리셋
  useEffect(() => {
    setCurrentPage(0);
    setAllPosts([]);
    setAllWikiActivities([]);
    setWikiRankingSnapshot(null);
  }, [section, sortBy, filterBy]);

  // React Query로 위키 활동 데이터 가져오기
  const todayForCache = new Date().toISOString().split('T')[0];
  const { data: wikiActivities = [], isLoading: wikiLoading } = useQuery({
    queryKey: ['wiki-activities', section, sortBy, selectedCategory, currentPage, filterBy, todayForCache],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      // My Fan 필터링: 내가 팔로우하는 wiki entries만
      let allowedEntryIds: string[] | null = null;
      if (filterBy === 'myfan' && user) {
        const { data: followedEntries } = await supabase
          .from('wiki_entry_followers')
          .select('wiki_entry_id')
          .eq('user_id', user.id);
        
        if (followedEntries && followedEntries.length > 0) {
          allowedEntryIds = followedEntries.map(f => f.wiki_entry_id);
        } else {
          // 팔로우하는 엔트리가 없으면 빈 결과 반환
          return [];
        }
      }
      
      // wiki_entries를 직접 쿼리하여 정렬 (본문이 있고 AI 생성 대기중이 아닌 것만)
      let entriesQuery = supabase
        .from('wiki_entries')
        .select(`
          id, title, slug, image_url, schema_type, likes_count, votes, 
          is_pinned, is_boosted, boosted_until, creator_id, updated_at, created_at,
          metadata, content, trending_score, aggregated_trending_score,
          creator:creator_id(username, avatar_url)
        `)
        .not('content', 'is', null)
        .neq('content', '')
        .not('content', 'ilike', '%Pending AI content generation%');
      
      // My Fan 필터 적용
      if (allowedEntryIds) {
        entriesQuery = entriesQuery.in('id', allowedEntryIds);
      }
      
      // sortBy에 따라 데이터베이스에서 정렬하여 가져오기
      if (sortBy === 'new') {
        entriesQuery = entriesQuery.order('updated_at', { ascending: false });
      } else if (sortBy === 'hot' || sortBy === 'best') {
        // hot과 best는 votes와 likes_count 기준으로 먼저 정렬
        entriesQuery = entriesQuery.order('votes', { ascending: false }).order('likes_count', { ascending: false });
      } else if (sortBy === 'top') {
        entriesQuery = entriesQuery.order('votes', { ascending: false });
      }
      
      const { data: entriesData, error: entriesError } = await entriesQuery.range(from, to);
      
      if (entriesError) throw entriesError;
      if (!entriesData || entriesData.length === 0) return [];
      
      // 각 엔트리의 최신 편집 이력 가져오기
      const entryIds = entriesData.map(e => e.id);
      const { data: editHistoryData, error: historyError } = await supabase
        .from('wiki_edit_history')
        .select(`
          *,
          profiles:editor_id(username, avatar_url)
        `)
        .in('wiki_entry_id', entryIds)
        .order('created_at', { ascending: false });
      
      if (historyError) throw historyError;
      
      // 각 엔트리별 최신 편집만 매칭
      const latestEdits = new Map<string, any>();
      editHistoryData?.forEach(edit => {
        if (!latestEdits.has(edit.wiki_entry_id)) {
          latestEdits.set(edit.wiki_entry_id, edit);
        }
      });
      
      // creator_id로 creator profiles 가져오기는 이제 필요없음 (이미 join으로 가져옴)
      
      // 엔트리와 편집 이력 결합 (AI 생성 대기중인 것 제외)
      const data = entriesData
        .filter(entry => {
          // "Pending AI content generation" 텍스트가 포함된 엔트리 제외
          if (entry.content && entry.content.includes('Pending AI content generation')) {
            return false;
          }
          return true;
        })
        .map(entry => {
          const edit = latestEdits.get(entry.id);
          return {
            id: edit?.id || entry.id,
            wiki_entry_id: entry.id,
            editor_id: edit?.editor_id || entry.creator_id,
            created_at: edit?.created_at || entry.updated_at,
            edited_at: edit?.created_at || entry.updated_at,
            edit_content: edit?.edit_content || '',
            edit_summary: edit?.edit_summary || '',
            new_content: edit?.new_content || null,
            previous_content: edit?.previous_content || null,
            new_title: edit?.new_title || null,
            previous_title: edit?.previous_title || null,
            new_image_url: edit?.new_image_url || null,
            previous_image_url: edit?.previous_image_url || null,
            new_metadata: edit?.new_metadata || null,
            previous_metadata: edit?.previous_metadata || null,
            wiki_entries: entry,
            profiles: edit?.profiles || null
          };
        });

      
      const wikiEntryIds = data.map(activity => activity.wiki_entry_id);
      
      // 가장 최신 snapshot 시간을 첫 페이지에서만 설정
      let snapshotTime = wikiRankingSnapshot;
      
      if (!snapshotTime || currentPage === 0) {
        // best와 new는 hot 순위를 사용
        const rankType = (sortBy === 'new' || sortBy === 'best') ? 'hot' : sortBy;
        
        const { data: latestSnapshot } = await supabase
          .from('wiki_entry_rankings')
          .select('snapshot_at')
          .eq('sort_type', rankType)
          .order('snapshot_at', { ascending: false })
          .limit(1)
          .single();
        
        snapshotTime = latestSnapshot?.snapshot_at || new Date().toISOString();
        
        // 첫 페이지에서만 snapshot 시간 저장
        if (currentPage === 0) {
          setWikiRankingSnapshot(snapshotTime);
        }
      }
      
      // 저장된 snapshot 시점의 순위 데이터 사용
      // best와 new는 hot 순위를 사용
      const rankType = (sortBy === 'new' || sortBy === 'best') ? 'hot' : sortBy;
      
      const { data: rankingsData } = await supabase
        .from('wiki_entry_rankings')
        .select('wiki_entry_id, rank, sort_type')
        .in('wiki_entry_id', wikiEntryIds)
        .eq('sort_type', rankType)
        .eq('snapshot_at', snapshotTime);
      
      console.log('Rankings data for sortBy:', sortBy, 'rankType:', rankType, 'snapshot:', snapshotTime, rankingsData);
      
      const currentRankings = new Map<string, number>();
      rankingsData?.forEach(ranking => {
        currentRankings.set(ranking.wiki_entry_id, ranking.rank);
      });
      
      let userVotes: any[] = [];
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        const { data: votesData } = await supabase
          .from('wiki_entry_votes')
          .select('wiki_entry_id, vote_type')
          .eq('user_id', user.id)
          .eq('vote_date', today)
          .in('wiki_entry_id', wikiEntryIds);
        userVotes = votesData || [];
      }
      
      const { data: comments } = await supabase
        .from('comments')
        .select('wiki_entry_id')
        .in('wiki_entry_id', wikiEntryIds);
      
      const commentCountMap = new Map<string, number>();
      comments?.forEach(comment => {
        const count = commentCountMap.get(comment.wiki_entry_id) || 0;
        commentCountMap.set(comment.wiki_entry_id, count + 1);
      });
      
      const activitiesWithCounts = data.map(activity => {
        const userVote = userVotes.find(v => v.wiki_entry_id === activity.wiki_entry_id);
        const currentRank = currentRankings.get(activity.wiki_entry_id);
        const previousRank = previousRankings[activity.wiki_entry_id];
        
        return {
          ...activity,
          commentCount: commentCountMap.get(activity.wiki_entry_id) || 0,
          userVote: userVote ? userVote.vote_type : null,
          currentRank,
          previousRank,
          rankChange: currentRank && previousRank ? previousRank - currentRank : undefined
        };
      });
      
      const newPreviousRankings: Record<string, number> = {};
      currentRankings.forEach((rank, entryId) => {
        newPreviousRankings[entryId] = rank;
      });
      setPreviousRankings(prev => ({ ...prev, ...newPreviousRankings }));
      setRankingsLoaded(true);
      
      return activitiesWithCounts;
    },
    staleTime: 5 * 60 * 1000, // 5분간 신선한 상태 유지
    gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
    enabled: section === "wiki" || section === "all" || selectedCategory === "KTrendz Wiki",
  });

  // 위키 활동이 로드될 때마다 allWikiActivities 업데이트
  useEffect(() => {
    console.log('Wiki activities updated, length:', wikiActivities.length, 'currentPage:', currentPage);
    if (wikiActivities.length > 0) {
      setAllWikiActivities(prev => {
        // 중복 제거하면서 추가
        const newActivities = wikiActivities.filter(activity => 
          !prev.some(a => a.wiki_entry_id === activity.wiki_entry_id)
        );
        console.log('Adding new wiki activities:', newActivities.length, 'total will be:', prev.length + newActivities.length);
        return [...prev, ...newActivities];
      });
    }
  }, [wikiActivities, currentPage]);

  // Load More 버튼 표시 조건: 로딩 중이 아니고, 현재 페이지 데이터가 꽉 찼을 때만
  const hasMorePosts = !loading && (
    (section === "wiki" ? allWikiActivities.length : allPosts.length) >= pageSize &&
    (section === "wiki" ? wikiActivities.length : posts.length) === pageSize
  );
  const displayPosts = useMemo(() => allPosts.length > 0 ? allPosts : posts, [allPosts, posts]);
  
  // Wiki activities를 정렬 (ALL 섹션과 동일한 로직) - useMemo로 최적화
  const displayWikiActivities = useMemo(() => {
    const sortedWikiActivities = [...(allWikiActivities.length > 0 ? allWikiActivities : wikiActivities)].sort((a, b) => {
      // Top 정렬에서는 trending_score만으로 정렬 (pinned/boosted 무시)
      // aggregated_trending_score가 있으면 그것을 사용, 없으면 trending_score 사용
      if (sortBy === "top") {
        const scoreA = (a.wiki_entries?.aggregated_trending_score && a.wiki_entries.aggregated_trending_score > 0) 
          ? a.wiki_entries.aggregated_trending_score 
          : (a.wiki_entries?.trending_score || 0);
        const scoreB = (b.wiki_entries?.aggregated_trending_score && b.wiki_entries.aggregated_trending_score > 0) 
          ? b.wiki_entries.aggregated_trending_score 
          : (b.wiki_entries?.trending_score || 0);
        return scoreB - scoreA;
      }
      
      // 다른 정렬에서는 pinned와 boosted 우선
      if (a.wiki_entries?.is_pinned && !b.wiki_entries?.is_pinned) return -1;
      if (!a.wiki_entries?.is_pinned && b.wiki_entries?.is_pinned) return 1;
      if (a.wiki_entries?.is_boosted && !b.wiki_entries?.is_boosted) return -1;
      if (!a.wiki_entries?.is_boosted && b.wiki_entries?.is_boosted) return 1;
      
      const createdAtA = new Date(a.created_at).getTime();
      const createdAtB = new Date(b.created_at).getTime();
      
      switch (sortBy) {
        case "new":
          // 최신순
          return createdAtB - createdAtA;
        
        case "hot":
          // Hot = trending_score / 시간 페널티 (급상승 감지)
          // aggregated_trending_score가 있으면 그것을 사용
          const now = Date.now();
          const hoursSinceA = (now - createdAtA) / (1000 * 60 * 60);
          const hoursSinceB = (now - createdAtB) / (1000 * 60 * 60);
          const hotScoreA = (a.wiki_entries?.aggregated_trending_score && a.wiki_entries.aggregated_trending_score > 0) 
            ? a.wiki_entries.aggregated_trending_score 
            : (a.wiki_entries?.trending_score || 0);
          const hotScoreB = (b.wiki_entries?.aggregated_trending_score && b.wiki_entries.aggregated_trending_score > 0) 
            ? b.wiki_entries.aggregated_trending_score 
            : (b.wiki_entries?.trending_score || 0);
          const scoreA = hotScoreA / Math.pow(hoursSinceA + 2, 1.5);
          const scoreB = hotScoreB / Math.pow(hoursSinceB + 2, 1.5);
          return scoreB - scoreA;
        
        case "best":
        default:
          // Best = trending_score / 시간 페널티 (완화된 시간 영향)
          // aggregated_trending_score가 있으면 그것을 사용
          const hoursA = (Date.now() - createdAtA) / (1000 * 60 * 60) + 6;
          const hoursB = (Date.now() - createdAtB) / (1000 * 60 * 60) + 6;
          const bestScoreARaw = (a.wiki_entries?.aggregated_trending_score && a.wiki_entries.aggregated_trending_score > 0) 
            ? a.wiki_entries.aggregated_trending_score 
            : (a.wiki_entries?.trending_score || 0);
          const bestScoreBRaw = (b.wiki_entries?.aggregated_trending_score && b.wiki_entries.aggregated_trending_score > 0) 
            ? b.wiki_entries.aggregated_trending_score 
            : (b.wiki_entries?.trending_score || 0);
          const bestScoreA = bestScoreARaw / Math.pow(hoursA, 0.8);
          const bestScoreB = bestScoreBRaw / Math.pow(hoursB, 0.8);
          return bestScoreB - bestScoreA;
      }
    });
    
    // sortBy가 'new'가 아닌 경우에만 순위 할당
    return sortedWikiActivities.map((activity, index) => ({
      ...activity,
      displayRank: sortBy !== 'new' ? index + 1 : undefined
    }));
  }, [allWikiActivities, wikiActivities, sortBy]);
  
  console.log('Wiki sorting debug:', {
    sortBy,
    count: displayWikiActivities.length,
    top5: displayWikiActivities.slice(0, 5).map(a => ({
      title: a.wiki_entries?.title,
      votes: a.wiki_entries?.votes,
      displayRank: a.displayRank
    }))
  });
  
  console.log('hasMorePosts:', hasMorePosts, 'posts.length:', posts.length, 'pageSize:', pageSize, 'section:', section, 'loading:', loading);


  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    
    // Wiki section: set sort to "new" by default
    if (section === "wiki") {
      setSortBy("new");
    } else {
      setSortBy("best");
    }
    
    setSelectedCategory("All"); // Reset category when section changes
  }, [section]);


  // Check daily login bonus only once when component mounts
  useEffect(() => {
    checkDailyLoginBonus();
  }, []);

  const checkDailyLoginBonus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call the daily login bonus function
      const { data, error } = await supabase.rpc('award_daily_login_bonus', {
        user_id_param: user.id
      });

      if (error) throw error;

      // If bonus was awarded (function returns true), show toast
      if (data === true) {
        toast({
          title: "Daily Login Bonus! 🎉",
          description: "+5 points awarded for logging in today!",
        });
      }
    } catch (error) {
      console.error('Error checking daily login bonus:', error);
    }
  };


  useEffect(() => {
    const handleScroll = () => {
      setShowSearchInHeader(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleVote = async (postId: string, type: "up" | "down") => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote on posts",
        variant: "destructive",
      });
      return;
    }

    const post = displayPosts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic UI update
    const oldUserVote = post.userVote;
    let newUserVote: "up" | "down" | null = type;
    let voteDelta = 0;

    if (post.userVote === type) {
      // 같은 버튼 클릭: 투표 취소
      newUserVote = null;
      voteDelta = type === "up" ? -1 : 1;
    } else if (post.userVote) {
      // 다른 버튼 클릭: 투표 변경
      voteDelta = type === "up" ? 2 : -2;
    } else {
      // 새 투표
      voteDelta = type === "up" ? 1 : -1;
    }

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = post.userVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const isVoteSwitch = post.userVote !== null && newUserVote !== null && post.userVote !== newUserVote;
    
    // 새 투표만 에너지 체크 (취소나 전환은 제외)
    if (!isUnvoting && !isVoteSwitch) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const { data: voteCheck, error: checkError } = await supabase
          .rpc('check_and_increment_vote_count', { 
            user_id_param: user.id,
            target_id_param: postId,
            target_type_param: 'post'
          });

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as { 
          can_vote: boolean; 
          max_votes: number; 
          remaining_votes: number; 
          current_level: number;
          completion_rewarded: boolean;
          is_first_vote_today: boolean;
        };

        if (!checkData?.is_first_vote_today) {
          toast({
            title: "Already voted today",
            description: "You can only vote once per post per day.",
            variant: "destructive",
          });
          return;
        }

        if (!checkData.can_vote) {
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive",
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          toast({
            title: "🎉 Daily Energy Completed!",
            description: `You earned bonus points for using all ${checkData.max_votes} energy today!`,
          });
          
          // 토큰 민팅 시작 알림 (1.5초 후)
          setTimeout(() => {
            toast({
              title: "Reward Token Minting...",
              description: "Processing your daily KTNZ token reward",
            });
          }, 1500);
          
          // 데일리 토큰 민팅 (2초 후)
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
                    action: <Button variant="outline" onClick={() => window.location.href = '/wallet'}>Create Wallet</Button>
                  });
                }
              } else if (mintData?.success) {
                toast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`,
                });
              }
            } catch (error) {
              console.error('Failed to mint daily tokens:', error);
            }
          }, 2000);
        } else {
          toast({
            title: "Vote counted",
            description: `Energy ${checkData.max_votes - checkData.remaining_votes}/${checkData.max_votes} used today`,
          });
        }
        
        // Navbar 업데이트 트리거
        window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
      } catch (error) {
        console.error("Error checking vote count:", error);
        toast({
          title: "Vote check failed",
          description: "Failed to check daily vote limit",
          variant: "destructive",
        });
        return;
      }
    }

    // Optimistic UI update
    setAllPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            votes: p.votes + voteDelta,
            userVote: newUserVote
          };
        }
        return p;
      })
    );

    // Database update
    try {
      if (newUserVote === null) {
        // 투표 취소
        const { error } = await supabase
          .from('post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표 생성 - 포인트 차감 확인
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_points', {
          user_id_param: user.id,
          action_type_param: 'vote_post',
          reference_id_param: postId
        });

        if (deductError || !deductResult) {
          toast({
            title: "Insufficient Stars",
            description: "You don't have enough points to vote",
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ['posts'] }); // Revert UI
          return;
        }

        // Show point deduction success
        toast({
          title: "Point Deducted",
          description: "1 point has been deducted for voting",
        });

        // Invalidate profile query to refresh points
        queryClient.invalidateQueries({ queryKey: ['profile', authUser?.id] });

        const { error } = await supabase
          .from('post_votes')
          .insert({
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
      
    } catch (error) {
      console.error('Error updating vote:', error);
      toast({
        title: "Vote failed",
        description: "Failed to update your vote. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  };

  const handleWikiVote = async (wikiEntryId: string, type: "up" | "down") => {
    console.log('handleWikiVote called:', { wikiEntryId, type, section, sortBy, selectedCategory });
    console.log('Current allWikiActivities:', allWikiActivities.length);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote on wiki entries",
        variant: "destructive",
      });
      return;
    }

    const activity = allWikiActivities.find(a => a.wiki_entry_id === wikiEntryId);
    console.log('Found activity:', activity);
    
    if (!activity) {
      console.error('Activity not found for wikiEntryId:', wikiEntryId);
      return;
    }

    const oldUserVote = activity.userVote;
    let newUserVote: "up" | "down" | null = type;
    let voteDelta = 0;

    if (activity.userVote === type) {
      newUserVote = null;
      voteDelta = type === "up" ? -1 : 1;
    } else if (activity.userVote) {
      voteDelta = type === "up" ? 2 : -2;
    } else {
      voteDelta = type === "up" ? 1 : -1;
    }

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = activity.userVote === type;

    if (!isUnvoting) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const { data: voteCheck, error: checkError } = await supabase
          .rpc('check_and_increment_vote_count', { 
            user_id_param: user.id,
            target_id_param: wikiEntryId,
            target_type_param: 'wiki_entry'
          });

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as { 
          can_vote: boolean; 
          max_votes: number; 
          remaining_votes: number; 
          current_level: number;
          completion_rewarded: boolean;
          is_first_vote_today: boolean;
        };

        if (!checkData?.is_first_vote_today) {
          toast({
            title: "Already voted today",
            description: "You can only vote once per entry per day.",
            variant: "destructive",
          });
          return;
        }

        if (!checkData.can_vote) {
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} energy today. Come back tomorrow!`,
            variant: "destructive",
          });
          return;
        }

        // 데일리 에너지 완료 시 포인트 및 토큰 보상
        if (checkData.completion_rewarded) {
          toast({
            title: "🎉 Daily Energy Completed!",
            description: `You earned bonus points for using all ${checkData.max_votes} energy today!`,
          });
          
          // 토큰 민팅 시작 알림 (1.5초 후)
          setTimeout(() => {
            toast({
              title: "Reward Token Minting...",
              description: "Processing your daily KTNZ token reward",
            });
          }, 1500);
          
          // 데일리 토큰 민팅 (2초 후)
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
                    ),
                  });
                }
              } else if (mintData?.success) {
                toast({
                  title: "Daily Tokens Earned! 🪙",
                  description: `You received ${mintData.amount} KTNZ tokens!`,
                });
              }
            } catch (error) {
              console.error('Failed to mint daily tokens:', error);
            }
          }, 2000);
        } else {
          toast({
            title: "Vote counted",
            description: `Energy ${checkData.max_votes - checkData.remaining_votes}/${checkData.max_votes} used today`,
          });
        }
        
        // Navbar 업데이트 트리거
        window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
      } catch (error) {
        console.error("Error checking vote count:", error);
        toast({
          title: "Vote check failed",
          description: "Failed to check daily vote limit",
          variant: "destructive",
        });
        return;
      }
    }

    // Optimistic UI update
    queryClient.setQueryData(['wiki-activities', section, sortBy, selectedCategory, currentPage], (oldData: any[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(a => {
        if (a.wiki_entry_id === wikiEntryId) {
          return {
            ...a,
            wiki_entries: {
              ...a.wiki_entries,
              votes: a.wiki_entries.votes + voteDelta
            },
            userVote: newUserVote
          };
        }
        return a;
      });
    });
    
    // allWikiActivities도 업데이트
    setAllWikiActivities(prev => prev.map(a => {
      if (a.wiki_entry_id === wikiEntryId) {
        return {
          ...a,
          wiki_entries: {
            ...a.wiki_entries,
            votes: a.wiki_entries.votes + voteDelta
          },
          userVote: newUserVote,
          // displayRank 유지
          displayRank: a.displayRank
        };
      }
      return a;
    }));

    // Database update
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (newUserVote === null) {
        const { error } = await supabase
          .from('wiki_entry_votes')
          .delete()
          .eq('wiki_entry_id', wikiEntryId)
          .eq('user_id', user.id)
          .eq('vote_date', today);

        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표 생성 - 포인트 차감 확인
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_points', {
          user_id_param: user.id,
          action_type_param: 'vote_wiki',
          reference_id_param: wikiEntryId
        });

        if (deductError || !deductResult) {
          toast({
            title: "Insufficient Stars",
            description: "You don't have enough points to vote",
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ['wiki-activities'] }); // Revert UI
          return;
        }

        // Show point deduction success
        toast({
          title: "Point Deducted",
          description: "1 point has been deducted for voting",
        });

        // Invalidate profile query to refresh points
        queryClient.invalidateQueries({ queryKey: ['profile', authUser?.id] });

        const { error } = await supabase
          .from('wiki_entry_votes')
          .insert({
            wiki_entry_id: wikiEntryId,
            user_id: user.id,
            vote_type: newUserVote,
            vote_date: today
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wiki_entry_votes')
          .update({ vote_type: newUserVote })
          .eq('wiki_entry_id', wikiEntryId)
          .eq('user_id', user.id)
          .eq('vote_date', today);

        if (error) throw error;
      }

      // 온체인 투표 기록 (upvote인 경우만, 관리자 제외)
      if (newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin && activity.wiki_entries?.title) {
        try {
          await supabase.functions.invoke('record-onchain-vote', {
            body: {
              eventId: null,
              oderId: null,
              voterAddressOrUserId: user.id,
              artistName: activity.wiki_entries.title,
              inviteCode: '',
              voteCount: 1
            }
          });
          console.log('[Index] On-chain vote recorded for entry:', activity.wiki_entries.title);

          // Footer 온체인 카운트 즉시 갱신 트리거
          window.dispatchEvent(new CustomEvent('onchainTxUpdated'));
        } catch (onchainError) {
          console.error('[Index] On-chain vote recording failed:', onchainError);
        }
      }
    } catch (error) {
      console.error('Error updating wiki vote:', error);
      toast({
        title: "Vote failed",
        description: "Failed to update your vote. Please try again.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['wiki-activities'] });
    }
  };

  const handleWikiBoost = async (wikiEntryId: string, hours: number) => {
    setWikiProcessing(prev => ({ ...prev, [wikiEntryId]: true }));
    try {
      const { error } = await supabase.rpc('boost_wiki_entry', {
        wiki_entry_id_param: wikiEntryId,
        duration_hours: hours
      });

      if (error) throw error;

      toast({
        title: "Wiki entry boosted!",
        description: `Your wiki entry will be boosted for ${hours} hours`,
      });
      setWikiBoostDialogs(prev => ({ ...prev, [wikiEntryId]: false }));
      queryClient.invalidateQueries({ queryKey: ['wiki-activities'] });
    } catch (error: any) {
      toast({
        title: "Boost failed",
        description: error.message || "Failed to boost wiki entry",
        variant: "destructive",
      });
    } finally {
      setWikiProcessing(prev => ({ ...prev, [wikiEntryId]: false }));
    }
  };

  const handleWikiPin = async (wikiEntryId: string) => {
    try {
      const { error } = await supabase.rpc('pin_wiki_entry', {
        wiki_entry_id_param: wikiEntryId
      });

      if (error) throw error;

      toast({
        title: "Wiki entry pinned!",
      });
      queryClient.invalidateQueries({ queryKey: ['wiki-activities'] });
    } catch (error: any) {
      toast({
        title: "Pin failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleWikiUnpin = async (wikiEntryId: string) => {
    try {
      const { error } = await supabase.rpc('unpin_wiki_entry', {
        wiki_entry_id_param: wikiEntryId
      });

      if (error) throw error;

      toast({
        title: "Wiki entry unpinned!",
      });
      queryClient.invalidateQueries({ queryKey: ['wiki-activities'] });
    } catch (error: any) {
      toast({
        title: "Unpin failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredPosts = useMemo(() => {
    return displayPosts.filter(post => {
      // Communities section: only show posts with communityId
      if (section === "communities") {
        const matchesCategory = selectedCategory === "All" || 
          (post.category && (
            post.category.split('-')[1] === selectedCategory ||
            post.category === selectedCategory
          ));
        const matchesSearch = searchQuery === "" || 
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (post.communityName && post.communityName.toLowerCase().includes(searchQuery.toLowerCase()));
        return post.communityId && matchesCategory && matchesSearch;
      }
      
      // All section: show all posts
      if (section === "all") {
        const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
        const matchesSearch = searchQuery === "" || 
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (post.communityName && post.communityName.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      }
      
      // Other sections: show posts matching section (community posts don't have category)
      const postSection = post.category ? post.category.split('-')[0].toLowerCase() : null;
      const postCategory = post.category ? (post.category.split('-')[1] || post.category) : null;
      
      const matchesSection = postSection === section.toLowerCase();
      const matchesCategory = selectedCategory === "All" || 
        (postCategory && (
          postCategory === selectedCategory ||
          post.category === selectedCategory
        ));
      const matchesSearch = searchQuery === "" || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.communityName && post.communityName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Show post if it matches section/category OR if it's a community post without category
      return (matchesSection && matchesCategory && matchesSearch) || 
             (!post.category && post.communityId && matchesSearch);
    });
  }, [displayPosts, section, selectedCategory, searchQuery]);

  // Wiki activities 검색 필터링 추가
  const filteredWikiActivities = useMemo(() => {
    if (searchQuery === "") {
      return displayWikiActivities;
    }
    
    return displayWikiActivities.filter(activity => {
      const title = activity.wiki_entries?.title || "";
      const content = activity.wiki_entries?.content || "";
      const editorName = activity.profiles?.username || "";
      const query = searchQuery.toLowerCase();
      
      return title.toLowerCase().includes(query) ||
             content.toLowerCase().includes(query) ||
             editorName.toLowerCase().includes(query);
    });
  }, [displayWikiActivities, searchQuery]);

  // Merge posts and wiki activities for "all" section only - useMemo로 최적화
  const allItems = useMemo(() => {
    return section === "all" 
      ? [
          ...filteredPosts.map(post => ({ ...post, type: 'post' as const })),
          ...filteredWikiActivities.map(activity => ({
            id: activity.wiki_entry_id,
            type: 'wiki' as const,
            votes: activity.wiki_entries.votes || 0,
            commentCount: activity.commentCount || 0,
            createdAt: new Date(activity.created_at),
            isPinned: activity.wiki_entries.is_pinned,
            isBoosted: activity.wiki_entries.is_boosted,
            wikiData: activity
          }))
        ]
      : filteredPosts.map(post => ({ ...post, type: 'post' as const }));
  }, [section, filteredPosts, filteredWikiActivities]);

  // Sort items based on selected sorting method - useMemo로 최적화
  const sortedItems = useMemo(() => {
    return [...allItems].sort((a: any, b: any) => {
      // Top 정렬에서는 trending_score만으로 정렬 (pinned/boosted 무시)
      // aggregated_trending_score가 있으면 그것을 사용, 없으면 trending_score 사용
      if (sortBy === "top") {
        const scoreA = a.type === 'wiki' 
          ? ((a.wikiData?.wiki_entries?.aggregated_trending_score && a.wikiData.wiki_entries.aggregated_trending_score > 0) 
            ? a.wikiData.wiki_entries.aggregated_trending_score 
            : (a.wikiData?.wiki_entries?.trending_score || 0))
          : (a.trendingScore || 0);
        const scoreB = b.type === 'wiki' 
          ? ((b.wikiData?.wiki_entries?.aggregated_trending_score && b.wikiData.wiki_entries.aggregated_trending_score > 0) 
            ? b.wikiData.wiki_entries.aggregated_trending_score 
            : (b.wikiData?.wiki_entries?.trending_score || 0))
          : (b.trendingScore || 0);
        return scoreB - scoreA;
      }
      
      // 다른 정렬에서는 pinned와 boosted를 우선
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isBoosted && !b.isBoosted) return -1;
      if (!a.isBoosted && b.isBoosted) return 1;
      
      // Then apply the selected sorting method
      switch (sortBy) {
        case "new":
          // Newest first
          return b.createdAt.getTime() - a.createdAt.getTime();
        
        case "hot":
          // Hot = trending_score / 시간 페널티 (급상승 감지)
          // aggregated_trending_score가 있으면 그것을 사용
          const now = Date.now();
          const hoursSinceA = (now - a.createdAt.getTime()) / (1000 * 60 * 60);
          const hoursSinceB = (now - b.createdAt.getTime()) / (1000 * 60 * 60);
          const hotScoreARaw = a.type === 'wiki' 
            ? ((a.wikiData?.wiki_entries?.aggregated_trending_score && a.wikiData.wiki_entries.aggregated_trending_score > 0) 
              ? a.wikiData.wiki_entries.aggregated_trending_score 
              : (a.wikiData?.wiki_entries?.trending_score || 0))
            : (a.trendingScore || 0);
          const hotScoreBRaw = b.type === 'wiki' 
            ? ((b.wikiData?.wiki_entries?.aggregated_trending_score && b.wikiData.wiki_entries.aggregated_trending_score > 0) 
              ? b.wikiData.wiki_entries.aggregated_trending_score 
              : (b.wikiData?.wiki_entries?.trending_score || 0))
            : (b.trendingScore || 0);
          const hotScoreA = hotScoreARaw / Math.pow(hoursSinceA + 2, 1.5);
          const hotScoreB = hotScoreBRaw / Math.pow(hoursSinceB + 2, 1.5);
          return hotScoreB - hotScoreA;
        
        case "best":
        default:
          // Best = trending_score / 시간 페널티 (완화된 시간 영향)
          // aggregated_trending_score가 있으면 그것을 사용
          const hoursA = (Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60) + 6;
          const hoursB = (Date.now() - b.createdAt.getTime()) / (1000 * 60 * 60) + 6;
          const bestScoreARaw = a.type === 'wiki' 
            ? ((a.wikiData?.wiki_entries?.aggregated_trending_score && a.wikiData.wiki_entries.aggregated_trending_score > 0) 
              ? a.wikiData.wiki_entries.aggregated_trending_score 
              : (a.wikiData?.wiki_entries?.trending_score || 0))
            : (a.trendingScore || 0);
          const bestScoreBRaw = b.type === 'wiki' 
            ? ((b.wikiData?.wiki_entries?.aggregated_trending_score && b.wikiData.wiki_entries.aggregated_trending_score > 0) 
              ? b.wikiData.wiki_entries.aggregated_trending_score 
              : (b.wikiData?.wiki_entries?.trending_score || 0))
            : (b.trendingScore || 0);
          const bestScoreA = bestScoreARaw / Math.pow(hoursA, 0.8);
          const bestScoreB = bestScoreBRaw / Math.pow(hoursB, 0.8);
          return bestScoreB - bestScoreA;
      }
    });
  }, [allItems, sortBy]);

  // For non-"all" sections, extract only posts - useMemo로 최적화
  const sortedPosts: Post[] = useMemo(() => {
    return section === "all" 
      ? [] 
      : sortedItems.filter((item: any) => item.type === 'post') as Post[];
  }, [section, sortedItems]);

  // 데이터베이스에서 이전 순위 불러오기
  useEffect(() => {
    const fetchPreviousRankings = async () => {
      if (sortBy === "new") {
        setRankingsLoaded(true);
        return;
      }

      try {
        // 1. 가장 최근 스냅샷 시간 찾기
        const { data: latestSnapshot, error: snapshotError } = await supabase
          .from("post_rankings")
          .select("snapshot_at")
          .eq("sort_type", sortBy)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .single();

        if (snapshotError || !latestSnapshot) {
          console.log("No previous rankings found");
          setRankingsLoaded(true);
          return;
        }

        // 2. 그 시간의 모든 순위 데이터 가져오기
        const { data, error } = await supabase
          .from("post_rankings")
          .select("post_id, rank")
          .eq("sort_type", sortBy)
          .eq("snapshot_at", latestSnapshot.snapshot_at);

        if (error) {
          console.error("Error fetching rankings:", error);
          setRankingsLoaded(true);
          return;
        }

        if (data && data.length > 0) {
          const rankings: Record<string, number> = {};
          data.forEach((item) => {
            rankings[item.post_id] = item.rank;
          });
          setPreviousRankings(rankings);
          console.log(`Loaded ${data.length} previous rankings for ${sortBy}`);
        } else {
          setPreviousRankings({});
        }
      } catch (error) {
        console.error("Error in fetchPreviousRankings:", error);
      } finally {
        setRankingsLoaded(true);
      }
    };

    fetchPreviousRankings();
  }, [sortBy]);

  const getRankChange = (postId: string, currentRank: number): number | undefined => {
    if (!previousRankings[postId]) return undefined;
    return previousRankings[postId] - currentRank; // 이전 순위 - 현재 순위 (양수면 상승)
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "News":
        return <TrendingUp className="w-5 h-5" />;
      case "Discussions":
        return <MessageSquare className="w-5 h-5" />;
      case "Original Content":
        return <Star className="w-5 h-5" />;
      case "Dramas":
        return <Flame className="w-5 h-5" />;
      case "Videos":
        return <Camera className="w-5 h-5" />;
      case "Travel":
        return <Plane className="w-5 h-5" />;
      case "Food":
        return <Utensils className="w-5 h-5" />;
      case "Fashion/Beauty":
        return <Sparkles className="w-5 h-5" />;
      case "Events":
        return <Calendar className="w-5 h-5" />;
      case "KTrendz Wiki":
        return <BookOpen className="w-5 h-5" />;
      default:
        return null;
    }
  };
  const getCategoryPosts = (category: string) => {
    return posts.filter(post => post.category === category).slice(0, 3);
  };
  
  // 무한 스크롤을 위한 Observer
  
  const pageContent = (
    <>
      <Helmet>
        <title>KTRENDZ: Transparent K-Pop Artist Support Platform</title>
        <meta name="description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
        <meta name="keywords" content="kpop artist support, fan support platform, kpop donations, transparent donations, on-chain donations, fan governance, kpop community, lightstick tokens, artist fund, korean culture, k-pop, kpop schedule, kpop news, korean drama, kdrama, korean entertainment, hallyu, k-culture, kpop idols, kpop groups, kpop wiki, korean celebrities, kpop fan community" />
        <link rel="canonical" href="https://k-trendz.com" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="KTRENDZ: Transparent K-Pop Artist Support Platform" />
        <meta property="og:description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
        <meta property="og:url" content="https://k-trendz.com" />
        <meta property="og:site_name" content="KTRENDZ" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="KTRENDZ: Transparent K-Pop Artist Support Platform" />
        <meta name="twitter:description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
      {isMobile && (
        <Navbar 
          showSearch={showSearchInHeader}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
      
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-3xl">
        {/* Logo and Search Section */}
        <div className="mb-4 md:mb-6 space-y-6 md:space-y-6">
          <div className="flex justify-center mt-6 md:mt-12">
            <img 
              src={liveTrendzLogo}
              alt="Live Trendz" 
              className="h-10 md:h-9"
            />
          </div>
          
          <div className="relative max-w-2xl mx-auto mb-2 md:mb-3">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-muted-foreground" />
            <Input placeholder="K Trendz..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 md:pl-12 pr-3 md:pr-4 h-10 md:h-12 text-sm md:text-base rounded-full" />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2 flex-wrap">
          {/* Filter Dropdown - All / My Fan */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 rounded-full text-xs h-8 px-3">
                {filterBy === "all" ? "All" : "My Fan"}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="bg-background z-50 w-[200px] max-h-[60vh]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem 
                onSelect={() => setFilterBy("all")}
                className={`cursor-pointer ${filterBy === "all" ? "bg-accent text-white" : ""}`}
              >
                All
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => setFilterBy("myfan")}
                className={`cursor-pointer ${filterBy === "myfan" ? "bg-accent text-white" : ""}`}
              >
                My Fan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Options - Visible Buttons */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => setSortBy("new")}
              className="rounded-full text-xs h-8 px-3 relative"
            >
              New
              {sortBy === "new" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
              )}
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => setSortBy("best")}
              className="rounded-full text-xs h-8 px-3 relative"
            >
              Best
              {sortBy === "best" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
              )}
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => setSortBy("hot")}
              className="rounded-full text-xs h-8 px-3 relative"
            >
              Hot
              {sortBy === "hot" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
              )}
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => setSortBy("top")}
              className="rounded-full text-xs h-8 px-3 relative"
            >
              Top
              {sortBy === "top" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
              )}
            </Button>
          </div>
        </div>

        {/* Reddit-style List View */}
        <div className="space-y-1.5 md:space-y-2">
          {section === "wiki" || selectedCategory === "KTrendz Wiki" ? (
            // Wiki Only View
            wikiLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Loading wiki activities...
                </div>
              </div>
            ) : filteredWikiActivities.length > 0 ? (
              filteredWikiActivities.map((activity) => {
                const isOwnEntry = user && activity.editor_id === user.id;
                
                return (
                  <Card key={`wiki-edit-${activity.id}`} className="p-3 md:p-4 hover:shadow-card-hover transition-shadow relative">
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex gap-2 z-10">
                      {activity.wiki_entries.is_pinned && (
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Pin className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      {activity.wiki_entries.is_boosted && (
                        <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary">
                          <Zap className="w-3 h-3" />
                          Boosted
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2 md:gap-4">
                      {/* 순위 표시 영역 (12위까지만) */}
                      {activity.displayRank && activity.displayRank <= 12 && (
                        <div className="flex flex-col items-center justify-start pt-1">
                          <div className="text-xl md:text-2xl font-bold text-muted-foreground/60 min-w-[1.5rem] text-center">
                            {activity.displayRank}
                          </div>
                          {activity.rankChange !== undefined && activity.rankChange !== 0 && (
                            <div className={`text-[10px] font-medium mt-0.5 ${
                              activity.rankChange > 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {activity.rankChange > 0 ? '▲' : '▼'}{Math.abs(activity.rankChange)}
                            </div>
                          )}
                          {activity.rankChange === 0 && (
                            <div className="text-[10px] font-medium mt-0.5 text-muted-foreground/40">
                              -
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 이미지 - 데스크톱 */}
                      <div className="hidden md:block">
                        <WikiImageCard 
                          wikiEntrySlug={activity.wiki_entries.slug}
                          imageUrl={getWikiDisplayImage(activity.wiki_entries)}
                          title={activity.wiki_entries.title}
                          size="medium"
                          trendingScore={isAdmin ? activity.wiki_entries.trending_score : undefined}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {/* 모바일: 이미지와 타이틀을 같은 행에 배치 */}
                          <div className="flex gap-2 mb-2 md:mb-0">
                            {/* 모바일 이미지 */}
                            <div className="md:hidden">
                              <WikiImageCard 
                                wikiEntrySlug={activity.wiki_entries.slug}
                                imageUrl={getWikiDisplayImage(activity.wiki_entries)}
                                title={activity.wiki_entries.title}
                                size="small"
                                trendingScore={isAdmin ? activity.wiki_entries.trending_score : undefined}
                              />
                            </div>
                            
                              <div className="flex-1 min-w-0">
                                <Link 
                                  to={`/k/${activity.wiki_entries.slug}`}
                                  className="block group mb-1"
                                >
                                  <h2 className="font-bold text-sm md:text-base lg:text-lg line-clamp-2">
                                    {activity.wiki_entries.title}
                                  </h2>
                                </Link>
                                
                                {/* 편집 카테고리 및 편집자 정보 */}
                                <div className="text-[11px] md:text-xs text-muted-foreground space-y-1">
                                  {/* Wiki edited 카테고리 표시 */}
                                  {(() => {
                                    // 편집 이력이 있는 경우
                                    if (activity.previous_content || activity.previous_title || activity.previous_image_url || activity.previous_metadata) {
                                      const changes = [];
                                      if (activity.new_content && activity.new_content !== activity.previous_content) changes.push("Content");
                                      if (activity.new_image_url && activity.new_image_url !== activity.previous_image_url) changes.push("Image");
                                      if (activity.new_title && activity.new_title !== activity.previous_title) changes.push("Title");
                                      if (activity.new_metadata && JSON.stringify(activity.new_metadata) !== JSON.stringify(activity.previous_metadata)) changes.push("Info");
                                      
                                      if (changes.length > 0) {
                                        return (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span>Wiki edited</span>
                                            <span className="text-[#ff4500] font-medium">{changes.join(", ")}</span>
                                          </div>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}
                                  
                                  {/* 편집자 정보 */}
                                  {activity.profiles?.username && (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span>by</span>
                                        <Avatar className="w-3 h-3">
                                          <AvatarImage 
                                            src={activity.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.profiles?.username}`} 
                                            alt={activity.profiles?.username || 'User'} 
                                          />
                                          <AvatarFallback className="text-[6px]">
                                            {(activity.profiles?.username || 'U')[0].toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <Link 
                                          to={`/u/${activity.profiles?.username}`} 
                                          className="font-medium hover:underline truncate max-w-[80px] md:max-w-none"
                                        >
                                          {activity.profiles?.username}
                                        </Link>
                                        <span className="hidden md:inline shrink-0">· {timeAgo(new Date(activity.edited_at))}</span>
                                      </div>
                                      <div className="md:hidden mt-0.5">
                                        {timeAgo(new Date(activity.edited_at))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                          </div>
                          
                          {/* 내용 - 별도 행 */}
                          <div className="mt-2">
                            {(() => {
                              // 본문 일부 추출 함수
                              const getContentPreview = () => {
                                if (activity.wiki_entries.content) {
                                  return activity.wiki_entries.content
                                    .replace(/<[^>]*>/g, '')
                                    .replace(/[#*`_~\[\]()]/g, '')
                                    .replace(/\n+/g, ' ')
                                    .trim()
                                    .substring(0, 150) + (activity.wiki_entries.content.length > 150 ? '...' : '');
                                }
                                return "";
                              };
                              
                              const contentPreview = getContentPreview();
                              
                              return contentPreview ? (
                                <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">
                                  {contentPreview}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        
                        {/* 액션 버튼들 - 카드 하단 */}
                        <div className="flex items-center justify-between gap-1.5 md:gap-4 mt-2">
                          <Link 
                            to={`/k/${activity.wiki_entries.slug}`}
                            className="flex items-center gap-0.5 md:gap-1 px-2 md:px-2.5 py-1 md:py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors text-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="hidden sm:inline">{activity.commentCount || 0} comments</span>
                            <span className="sm:hidden">{activity.commentCount || 0}</span>
                          </Link>
                          
                          <div className="flex items-center gap-1 md:gap-2 ml-auto">
                            {/* 보팅 버튼을 우하단으로 이동 */}
                            <VoteButtons
                              votes={activity.wiki_entries.votes}
                              userVote={activity.userVote}
                              onVote={(type) => handleWikiVote(activity.wiki_entry_id, type)}
                              vertical={false}
                            />
                            
                              {isOwnEntry && !activity.wiki_entries.is_boosted && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  onClick={() => setWikiBoostDialogs(prev => ({ ...prev, [activity.wiki_entry_id]: true }))}
                                  className="gap-1 h-7 md:h-8 px-2 md:px-3 rounded-full text-xs"
                                >
                                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  <span className="hidden md:inline">Boost</span>
                                </Button>
                              )}
                            
                            {isAdmin && (
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 px-2">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  align="end"
                                  onCloseAutoFocus={(e) => e.preventDefault()}
                                >
                                  {activity.wiki_entries.is_pinned ? (
                                    <DropdownMenuItem onSelect={() => handleWikiUnpin(activity.wiki_entry_id)}>
                                      <Pin className="w-4 h-4 mr-2" />
                                      Unpin Wiki Entry
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onSelect={() => handleWikiPin(activity.wiki_entry_id)}>
                                      <Pin className="w-4 h-4 mr-2" />
                                      Pin Wiki Entry
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setDeleteHistoryId(activity.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete History
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Boost Dialog */}
                    <BoostPostDialog
                      open={wikiBoostDialogs[activity.wiki_entry_id] || false}
                      onOpenChange={(open) => setWikiBoostDialogs(prev => ({ ...prev, [activity.wiki_entry_id]: open }))}
                      onConfirm={(hours) => handleWikiBoost(activity.wiki_entry_id, hours)}
                      hourlyRate={5}
                      isProcessing={wikiProcessing[activity.wiki_entry_id] || false}
                    />
                  </Card>
                );
              })
            ) : filterBy === 'myfan' && !user ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <p className="text-muted-foreground">Please log in to see posts from your favorite artists.</p>
                <Button 
                  onClick={() => window.location.href = '/auth'}
                  className="rounded-full"
                >
                  Log In
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-lg">
                No wiki activities yet.
              </div>
            )
          ) : section === "all" ? (
            // All Section: Show merged and ranked posts and wiki
            loading || wikiLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Loading content...
                </div>
              </div>
            ) : sortedItems.length > 0 ? (
              sortedItems.map((item: any, index) => {
                const currentRank = index + 1;
                const showRank = sortBy !== "new" && currentRank <= 12;
                const rankChange = showRank ? getRankChange(item.id, currentRank) : undefined;
                
                if (item.type === 'post') {
                  return (
                    <PostCard 
                      key={item.id} 
                      {...item} 
                      userId={item.user_id}
                      onVote={handleVote} 
                      currentSection={section}
                      communityId={item.communityId}
                      communityName={item.communityName}
                      communitySlug={item.communitySlug}
                      communityIcon={item.communityIcon}
                      currentUserId={user?.id}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['posts'] })}
                      rank={showRank ? currentRank : undefined}
                      rankChange={rankChange}
                      trendingScore={isAdmin ? item.trendingScore : undefined}
                      metadata={item.metadata}
                      eventDate={item.eventDate}
                    />
                  );
                } else {
                  // Wiki item
                  const activity = item.wikiData;
                  const isOwnEntry = user && activity.editor_id === user.id;
                  
                  return (
                    <Card key={`wiki-${item.id}`} className="p-3 md:p-4 hover:shadow-card-hover transition-shadow relative">
                      {/* Badges */}
                      <div className="absolute top-2 right-2 flex gap-2 z-10">
                        {activity.wiki_entries.is_pinned && (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Pin className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        {activity.wiki_entries.is_boosted && (
                          <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary">
                            <Zap className="w-3 h-3" />
                            Boosted
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-2 md:gap-4">
                        {/* 순위 표시 영역 (12위까지만) */}
                        {showRank && (
                          <div className="flex flex-col items-center justify-start pt-1">
                            <div className="text-xl md:text-2xl font-bold text-muted-foreground/60 min-w-[1.5rem] text-center">
                              {currentRank}
                            </div>
                            {rankChange !== undefined && rankChange !== 0 && (
                              <div className={`text-[10px] font-medium mt-0.5 ${
                                rankChange > 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {rankChange > 0 ? '▲' : '▼'}{Math.abs(rankChange)}
                              </div>
                            )}
                            {rankChange === 0 && (
                              <div className="text-[10px] font-medium mt-0.5 text-muted-foreground/40">
                                -
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 이미지 - 데스크톱 */}
                        <Link 
                          to={`/k/${activity.wiki_entries.slug}`}
                          className="hidden md:block flex-shrink-0"
                        >
                          <div className="w-48 h-48 lg:w-60 lg:h-60 rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity flex items-center justify-center relative">
                            {activity.wiki_entries.image_url ? (
                              <img 
                                src={activity.wiki_entries.image_url} 
                                alt={activity.wiki_entries.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <User className="w-12 h-12 text-muted-foreground" />
                            )}
                            {isAdmin && activity.wiki_entries.trending_score !== undefined && (
                              <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
                                  T: {activity.wiki_entries.trending_score}
                                </Badge>
                                {activity.wiki_entries.aggregated_trending_score && 
                                 activity.wiki_entries.aggregated_trending_score > activity.wiki_entries.trending_score && (
                                  <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 backdrop-blur-sm border-white/30 text-white font-semibold">
                                    A: {activity.wiki_entries.aggregated_trending_score}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            {/* 모바일: 이미지와 타이틀을 같은 행에 배치 */}
                            <div className="flex gap-2 mb-2 md:mb-0">
                              {/* 모바일 이미지 */}
                              <Link 
                                to={`/k/${activity.wiki_entries.slug}`}
                                className="md:hidden flex-shrink-0"
                              >
                                <div className="w-24 h-24 rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity flex items-center justify-center relative">
                                  {activity.wiki_entries.image_url ? (
                                    <img 
                                      src={activity.wiki_entries.image_url} 
                                      alt={activity.wiki_entries.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <User className="w-8 h-8 text-muted-foreground" />
                                  )}
                                  {isAdmin && activity.wiki_entries.trending_score !== undefined && (
                                    <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                                      <Badge className="text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
                                        T: {activity.wiki_entries.trending_score}
                                      </Badge>
                                      {activity.wiki_entries.aggregated_trending_score && 
                                       activity.wiki_entries.aggregated_trending_score > activity.wiki_entries.trending_score && (
                                        <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 backdrop-blur-sm border-white/30 text-white font-semibold">
                                          A: {activity.wiki_entries.aggregated_trending_score}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Link>
                              
                              <div className="flex-1 min-w-0">
                                <Link 
                                  to={`/k/${activity.wiki_entries.slug}`}
                                  className="block group mb-1"
                                >
                                  <h2 className="font-bold text-sm md:text-base lg:text-lg line-clamp-2">
                                    {activity.wiki_entries.title}
                                  </h2>
                                </Link>
                                
                                {/* 편집 카테고리 및 작성자 정보 */}
                                <div className="text-[11px] md:text-xs text-muted-foreground space-y-1">
                                  {/* Wiki created/edited 카테고리 표시 */}
                                  {(() => {
                                    // 편집 이력이 있는 경우
                                    if (activity.previous_content || activity.previous_title || activity.previous_image_url || activity.previous_metadata) {
                                      const changes = [];
                                      if (activity.new_content && activity.new_content !== activity.previous_content) changes.push("Content");
                                      if (activity.new_image_url && activity.new_image_url !== activity.previous_image_url) changes.push("Image");
                                      if (activity.new_title && activity.new_title !== activity.previous_title) changes.push("Title");
                                      if (activity.new_metadata && JSON.stringify(activity.new_metadata) !== JSON.stringify(activity.previous_metadata)) changes.push("Info");
                                      
                                      if (changes.length > 0) {
                                        return (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span>Wiki edited</span>
                                            <span className="text-[#ff4500] font-medium">{changes.join(", ")}</span>
                                          </div>
                                        );
                                      }
                                    } else {
                                      // 새로 생성된 위키 엔트리
                                      return (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[#ff4500] font-medium">Wiki created</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  
                                  {/* 작성자/편집자 정보 */}
                                  {(() => {
                                    // 편집자 정보 우선, 없으면 작성자 정보 사용
                                    const displayProfile = activity.profiles || activity.wiki_entries.creator;
                                    const displayTime = activity.edited_at || activity.wiki_entries.created_at;
                                    
                                    if (displayProfile?.username) {
                                      return (
                                        <>
                                          <div className="flex items-center gap-1">
                                            <span>by</span>
                                            <Avatar className="w-3 h-3">
                                              <AvatarImage 
                                                src={displayProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayProfile.username}`} 
                                                alt={displayProfile.username || 'User'} 
                                              />
                                              <AvatarFallback className="text-[6px]">
                                                {(displayProfile.username || 'U')[0].toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <Link 
                                              to={`/u/${displayProfile.username}`} 
                                              className="font-medium hover:underline truncate max-w-[80px] md:max-w-none"
                                            >
                                              {displayProfile.username}
                                            </Link>
                                            <span className="hidden md:inline shrink-0">· {timeAgo(new Date(displayTime))}</span>
                                          </div>
                                          <div className="md:hidden mt-0.5">
                                            {timeAgo(new Date(displayTime))}
                                          </div>
                                        </>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </div>
                            
                            {/* 내용 - 별도 행 */}
                            <div className="mt-2">
                              {(() => {
                                // 본문 일부 추출 함수
                                const getContentPreview = () => {
                                  if (activity.wiki_entries.content) {
                                    return activity.wiki_entries.content
                                      .replace(/<[^>]*>/g, '')
                                      .replace(/[#*`_~\[\]()]/g, '')
                                      .replace(/\n+/g, ' ')
                                      .trim()
                                      .substring(0, 150) + (activity.wiki_entries.content.length > 150 ? '...' : '');
                                  }
                                  return "";
                                };
                                
                                const contentPreview = getContentPreview();
                                
                                return contentPreview ? (
                                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">
                                    {contentPreview}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          
                          {/* 하단 정보 */}
                          <div className="flex items-center justify-between gap-1.5 md:gap-4 mt-2">
                            <Link 
                              to={`/k/${activity.wiki_entries.slug}`}
                              className="flex items-center gap-0.5 md:gap-1 px-2 md:px-2.5 py-1 md:py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors text-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              <span className="hidden sm:inline">{activity.commentCount || 0} comments</span>
                              <span className="sm:hidden">{activity.commentCount || 0}</span>
                            </Link>
                            
                            <div className="flex items-center gap-1 md:gap-2 ml-auto">
                              {/* Vote Buttons */}
                              <VoteButtons
                                votes={activity.wiki_entries.votes || 0}
                                userVote={activity.userVote}
                                onVote={(type) => handleWikiVote(activity.wiki_entry_id, type)}
                                vertical={false}
                              />
                              
                              {/* Boost Button */}
                              {isOwnEntry && !activity.wiki_entries.is_boosted && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  onClick={() => setWikiBoostDialogs(prev => ({ ...prev, [activity.wiki_entry_id]: true }))}
                                  className="gap-1 h-7 md:h-8 px-2 md:px-3 rounded-full text-xs"
                                >
                                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  <span className="hidden md:inline">Boost</span>
                                </Button>
                              )}
                              
                              {/* Admin Menu */}
                              {isAdmin && (
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 px-2">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent 
                                    align="end"
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    {activity.wiki_entries.is_pinned ? (
                                      <DropdownMenuItem onSelect={() => handleWikiUnpin(activity.wiki_entry_id)}>
                                        <Pin className="w-4 h-4 mr-2" />
                                        Unpin Wiki Entry
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onSelect={() => handleWikiPin(activity.wiki_entry_id)}>
                                        <Pin className="w-4 h-4 mr-2" />
                                        Pin Wiki Entry
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => setDeleteHistoryId(activity.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete History
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Boost Dialog */}
                      <BoostPostDialog
                        open={wikiBoostDialogs[activity.wiki_entry_id] || false}
                        onOpenChange={(open) => setWikiBoostDialogs(prev => ({ ...prev, [activity.wiki_entry_id]: open }))}
                        onConfirm={(hours) => handleWikiBoost(activity.wiki_entry_id, hours)}
                        hourlyRate={5}
                        isProcessing={wikiProcessing[activity.wiki_entry_id] || false}
                      />
                    </Card>
                  );
                }
              })
            ) : filterBy === 'myfan' && !user ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <p className="text-muted-foreground">Please log in to see posts from your favorite artists.</p>
                <Button 
                  onClick={() => window.location.href = '/auth'}
                  className="rounded-full"
                >
                  Log In
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-lg">
                No content available.
              </div>
            )
          ) : (
            // Regular Posts View
            loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Loading posts...
                </div>
              </div>
            ) : sortedPosts.length > 0 ? (
              sortedPosts.map((post, index) => {
                const currentRank = index + 1;
                const rankChange = sortBy !== "new" && index < 12 ? getRankChange(post.id, currentRank) : undefined;
                
                return (
                  <PostCard 
                    key={post.id} 
                    {...post} 
                    userId={post.user_id}
                    onVote={handleVote} 
                    currentSection={section}
                    communityId={post.communityId}
                    communityName={post.communityName}
                    communitySlug={post.communitySlug}
                    communityIcon={post.communityIcon}
                    currentUserId={user?.id}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['posts'] })}
                    rank={sortBy !== "new" ? currentRank : undefined}
                    rankChange={rankChange}
                    trendingScore={isAdmin ? post.trendingScore : undefined}
                    metadata={post.metadata}
                    eventDate={post.eventDate}
                  />
                );
              })
            ) : filterBy === 'myfan' && !user ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <p className="text-muted-foreground">Please log in to see posts from your favorite artists.</p>
                <Button 
                  onClick={() => window.location.href = '/auth'}
                  className="rounded-full"
                >
                  Log In
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-lg">
                No posts yet.
              </div>
            )
          )}
          
          {/* Load More 버튼 - 모든 섹션에서 표시 */}
          {hasMorePosts && !loading && !wikiLoading && (
            section === "all" 
              ? (allPosts.length > 0 || allWikiActivities.length > 0) 
              : section === "wiki"
                ? allWikiActivities.length > 0
                : allPosts.length > 0
          ) && (
            <div className="flex justify-center py-8">
              <Button
                onClick={() => {
                  console.log('Load More clicked, currentPage:', currentPage, 'posts.length:', posts.length, 'allPosts.length:', allPosts.length);
                  // 현재 스크롤 위치 저장
                  scrollPositionRef.current = window.scrollY;
                  console.log('Saved scroll position:', scrollPositionRef.current);
                  setCurrentPage(prev => prev + 1);
                }}
                disabled={loading || wikiLoading}
                size="lg"
                className="min-w-[200px] rounded-full"
              >
                Load More
              </Button>
            </div>
          )}
          
        </div>
      </div>
      
      <AlertDialog open={!!deleteHistoryId} onOpenChange={() => setDeleteHistoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Edit History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this edit history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteHistoryId) {
                  const { error } = await supabase
                    .from('wiki_edit_history')
                    .delete()
                    .eq('id', deleteHistoryId);
                  
                  if (!error) {
                    sonnerToast.success("Edit history deleted");
                    queryClient.invalidateQueries({ queryKey: ['wiki-activities'] });
                  } else {
                    sonnerToast.error("Failed to delete");
                  }
                  setDeleteHistoryId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {isMobile && <Footer />}
    </div>
    </>
  );

  // PC: V2Layout 래핑, 모바일: 기존 레이아웃
  if (!isMobile) {
    return (
      <V2Layout showMobileHeader={false} pcHeaderTitle="Posts">
        {pageContent}
      </V2Layout>
    );
  }

  return pageContent;
};
export default Index;