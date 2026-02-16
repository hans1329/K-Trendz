import { useState, useEffect, useRef, useMemo } from "react";
import { calculateStripeTotal } from "@/hooks/useFanzTokenPrice";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SignupCtaBanner from "@/components/SignupCtaBanner";
import PostCard from "@/components/PostCard";
import SmartImage from "@/components/SmartImage";
import { getAvatarThumbnail, getCardThumbnail, getCarouselThumbnail } from "@/lib/image";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { TrendingUp, Flame, Star, Eye, Check, ChevronsUpDown, Clock, Search, Trophy, Users, User, Verified, Wand2, Crown, ChevronUp, ChevronDown, Tag as TagIcon, Pencil, ArrowLeft, Trash2, ChevronLeft, ChevronRight, Lock, FileText, ArrowBigUp, MessageSquare, ThumbsUp, Sparkles, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import liveTrendzLogo from "@/assets/live-trendz.webp";
import challengeBanner from "@/assets/challenge-banner.jpg";
import CreateSpecialEventDialog from "@/components/CreateSpecialEventDialog";
import ActiveVotesSection from "@/components/ActiveVotesSection";
interface RankingItem {
  id: string;
  title: string;
  slug: string;
  content?: string;
  aggregated_trending_score: number;
  aggregated_votes: number;
  aggregated_view_count: number;
  aggregated_follower_count?: number;
  votes: number;
  image_url?: string;
  created_at?: string;
  creator?: {
    username: string;
    avatar_url?: string;
  };
  type: 'post' | 'wiki';
}
interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  votes: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
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
  trendingScore?: number;
  rank?: number;
  metadata?: {
    image_visibility?: 'private' | 'followers' | 'token_holders' | 'scheduled';
    min_token_holdings?: number;
  } | null;
  eventDate?: string | null;
  isFollowing?: boolean;
  visibility?: string;
  slug?: string;
  isFanPost?: boolean;
}

// Schema type 라벨 매핑
const SCHEMA_TYPE_LABELS: {
  [key: string]: string;
} = {
  'artist': 'K-Pop Artists',
  'group': 'Groups',
  'member': 'K-Pop Member',
  'actor': 'K-Actors',
  'album': 'Albums',
  'song': 'Songs',
  'movie': 'Movies',
  'drama': 'Dramas',
  'variety_show': 'Variety Shows',
  'event': 'Events',
  'beauty_brand': 'Beauty Brands',
  'beauty_product': 'Beauty Products',
  'restaurant': 'Restaurants',
  'food': 'K-Food',
  'food_brand': 'Food Brands',
  'food_product': 'Food Products',
  'brand': 'Brands',
  'youtuber': 'YouTubers',
  'news': 'News',
  'travel': 'Travel'
};
const Rankings = () => {
  const {
    category
  } = useParams<{
    category?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL 파라미터 또는 sessionStorage에서 탭 상태 복원
  const getInitialSortBy = (): 'trending' | 'wiki-trending' | 'new' => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'new') return 'new';

    // sort 파라미터가 없으면 sessionStorage에서 new가 아닌 값만 복원
    const saved = sessionStorage.getItem('rankingsTab');
    if (saved === 'trending' || saved === 'wiki-trending') {
      return saved;
    }
    return 'trending';
  };
  const [sortBy, setSortByState] = useState<'trending' | 'wiki-trending' | 'new'>(getInitialSortBy);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPage, setNewPage] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const [showPopularTags, setShowPopularTags] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [schemaToggle, setSchemaToggle] = useState<'artist' | 'member' | 'actor'>('artist'); // 아티스트/멤버/배우 3단계 토글
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // 검색창 확장 상태
  const [isDeleting, setIsDeleting] = useState(false);
  const [randomEntries, setRandomEntries] = useState<any[]>([]);
  const {
    user
  } = useAuth();
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // 관리자 권한 체크
  const {
    data: isAdmin = false,
    isLoading: isAdminLoading
  } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const {
        data
      } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      return !!data;
    },
    enabled: !!user
  });

  // 멤버/배우 탭은 관리자만 상세 페이지 이동 허용
  const shouldBlockMemberActor = !isAdminLoading && !isAdmin && (schemaToggle === 'member' || schemaToggle === 'actor');
  const showMemberActorComingSoon = () => {
    toast({
      title: "Coming Soon",
      description: "This section will be available soon."
    });
  };
  const navigateToEntry = (slug: string) => {
    if (shouldBlockMemberActor) {
      showMemberActorComingSoon();
      return;
    }
    navigate(`/k/${slug}`);
  };

  // Rankings 배너 설정 가져오기
  const {
    data: rankingsBannerSettings
  } = useQuery({
    queryKey: ['rankings-banner-settings'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'rankings_banner_url').maybeSingle();
      if (error || !data) {
        // 기본 배너 설정 반환
        return {
          url: challengeBanner,
          link: '/challenges',
          linkEnabled: true
        };
      }
      const value = data.setting_value as {
        url?: string;
        link?: string;
        linkEnabled?: boolean;
      };
      return {
        url: value?.url || challengeBanner,
        link: value?.link || '/challenges',
        linkEnabled: value?.linkEnabled !== false
      };
    },
    staleTime: 10 * 60 * 1000 // 10분간 캐시 유지 (배너는 자주 안 바뀜)
  });

  // 최근 거래/발행 응원봉 티커 데이터 가져오기
  const {
    data: tickerData = []
  } = useQuery({
    queryKey: ['fanz-token-ticker'],
    queryFn: async () => {
      // 온체인에 등록된(total_supply > 0) 토큰의 최근 거래 가져오기
      const {
        data: transactions,
        error: txError
      } = await supabase.from('fanz_transactions').select(`
          id,
          price_per_token,
          transaction_type,
          created_at,
          fanz_token_id,
          fanz_tokens!inner (
            id,
            token_id,
            total_supply,
            wiki_entry_id,
            wiki_entries!inner (
              id,
              title,
              slug
            )
          )
        `)
        // .gt('fanz_tokens.total_supply', 0) // 온체인 등록된 토큰만 (필터로 인해 티커가 비는 케이스 방지)
        .order('created_at', { ascending: false })
        .limit(30);
      if (txError) {
        console.error('Error fetching transactions:', txError);
      }

      type TickerItem = {
        title: string;
        slug: string;
        currentPrice: number;
        todayFirstPrice: number | null;
        transactionType: string;
        createdAt: string;
        tokenIdOnchain?: string;
        totalSupply?: number;
        dbPrice?: number;
      };

      // 오늘 0시 (UTC 기준)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 토큰별로 그룹화하여 정보 수집
      const tokenMap = new Map<string, TickerItem>();
      if (transactions && transactions.length > 0) {
        const tokenTransactions = new Map<string, any[]>();
        transactions.forEach((tx: any) => {
          const tokenRowId = tx.fanz_token_id;
          if (!tokenTransactions.has(tokenRowId)) tokenTransactions.set(tokenRowId, []);
          tokenTransactions.get(tokenRowId)!.push(tx);
        });
        tokenTransactions.forEach((txList, tokenRowId) => {
          const latestTx = txList[0];
          const fanzToken = latestTx.fanz_tokens;
          const wikiEntry = fanzToken?.wiki_entries;
          if (!wikiEntry || !fanzToken) return;

          const todayFirstTx = txList
            .filter((tx: any) => tx.created_at >= todayISO && tx.transaction_type === 'buy')
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          
          const todayFirstPriceValue = todayFirstTx ? Number(todayFirstTx.price_per_token ?? 0) : null;
          const todayFirstPrice = todayFirstPriceValue && Number.isFinite(todayFirstPriceValue) && todayFirstPriceValue > 0 
            ? todayFirstPriceValue 
            : null;

          // 가장 최근 거래 가격을 DB fallback으로 저장
          const dbPrice = Number(latestTx.price_per_token ?? 0);

          tokenMap.set(tokenRowId, {
            title: wikiEntry.title,
            slug: wikiEntry.slug,
            currentPrice: 0,
            todayFirstPrice,
            transactionType: latestTx.transaction_type,
            createdAt: latestTx.created_at,
            tokenIdOnchain: fanzToken.token_id,
            totalSupply: fanzToken.total_supply,
            dbPrice: dbPrice > 0 ? dbPrice : undefined,
          });
        });
      }

      // 거래 데이터가 부족하면 최근 발행된 온체인 토큰 가져오기
      if (tokenMap.size < 10) {
        const {
          data: tokens,
          error: tokenError
        } = await supabase.from('fanz_tokens').select(`
            id,
            token_id,
            total_supply,
            base_price,
            created_at,
            wiki_entries!inner (
              id,
              title,
              slug
            )
          `)
          // .gt('total_supply', 0) // 온체인 등록된 토큰만 (필터로 인해 티커가 비는 케이스 방지)
          .order('created_at', { ascending: false })
          .limit(15);
        if (tokenError) {
          console.error('Error fetching tokens:', tokenError);
        }
        if (tokens) {
          tokens.forEach((token: any) => {
            if (!tokenMap.has(token.id) && token.wiki_entries) {
              tokenMap.set(token.id, {
                title: token.wiki_entries.title,
                slug: token.wiki_entries.slug,
                currentPrice: 0,
                todayFirstPrice: null,
                transactionType: 'issued',
                createdAt: token.created_at,
                tokenIdOnchain: token.token_id,
                totalSupply: token.total_supply,
                dbPrice: token.base_price > 0 ? token.base_price : 0.50,
              });
            }
          });
        }
      }

      // ✅ 온체인 가격 조회 (최대 10개만, 성능 최적화)

      const baseItems = Array.from(tokenMap.values()).slice(0, 10);
      const tokenIds = baseItems.map(item => item.tokenIdOnchain).filter(Boolean) as string[];
      
      let priceMap = new Map<string, number>();
      if (tokenIds.length > 0) {
        try {
          // 최대 10개만 병렬 조회 (타임아웃으로 티커 렌더 블로킹 방지)
          const TIMEOUT_MS = 2500;
          const pricePromises = tokenIds.map(async (tokenId) => {
            try {
              const invokePromise = supabase.functions.invoke('get-fanztoken-price', {
                body: { tokenId, amount: 1 }
              });
              const result = await Promise.race([
                invokePromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
              ]) as any;

              if (!result) return null;
              const { data, error } = result as any;

              if (!error && data?.success && data?.data?.isOnchainData) {
                const buyCostUsd = Number(data.data.buyCost ?? 0);
                if (Number.isFinite(buyCostUsd) && buyCostUsd > 0) {
                  return { tokenId, price: Math.max(calculateStripeTotal(buyCostUsd), 0.50) };
                }
              }
              return null;
            } catch {
              return null;
            }
          });
          const settled = await Promise.allSettled(pricePromises);
          settled.forEach((res) => {
            if (res.status === 'fulfilled' && res.value) priceMap.set(res.value.tokenId, res.value.price);
          });
        } catch (err) {
          console.error('Error fetching batch prices:', err);
        }
      }

      // 온체인 가격 우선, 없으면 DB 가격 fallback
      const itemsWithPrice = baseItems.map(item => {
        const onchainPrice = item.tokenIdOnchain ? priceMap.get(item.tokenIdOnchain) : undefined;
        const finalPrice = onchainPrice ?? (item.dbPrice ? calculateStripeTotal(item.dbPrice) : 0.50);
        return { ...item, currentPrice: Math.max(finalPrice, 0.50) };
      });

      return itemsWithPrice.slice(0, 10);
    },
    refetchInterval: 60000, // 30초 → 60초로 늘림
    staleTime: 30000, // 30초간 캐시 유지
  });

  // ✅ tickerData lookup용 slug → item Map (O(1) 조회)
  const tickerMap = useMemo(() => {
    const map = new Map<string, typeof tickerData[number]>();
    tickerData.forEach(item => map.set(item.slug, item));
    return map;
  }, [tickerData]);

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'new') {
      setSortByState('new');
      sessionStorage.setItem('rankingsTab', 'new');
    } else {
      // URL에서 sort=new가 없으면 trending으로 전환
      setSortByState('trending');
      sessionStorage.setItem('rankingsTab', 'trending');
    }
  }, [searchParams]);

  // 탭 변경 시 sessionStorage에 저장 및 URL 업데이트
  const setSortBy = (value: 'trending' | 'wiki-trending' | 'new') => {
    sessionStorage.setItem('rankingsTab', value);
    setSortByState(value);
    setSelectedEntries(new Set()); // 탭 변경 시 선택 초기화

    // URL 파라미터 업데이트
    if (value === 'new') {
      setSearchParams({
        sort: 'new'
      });
    } else {
      searchParams.delete('sort');
      setSearchParams(searchParams);
    }
  };

  // 엔트리 선택 토글
  const toggleEntrySelection = (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  // 일괄 삭제 처리
  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    setIsDeleting(true);
    try {
      const entriesToDelete = Array.from(selectedEntries);

      // wiki_entries 삭제
      const {
        error
      } = await supabase.from('wiki_entries').delete().in('id', entriesToDelete);
      if (error) throw error;
      toast({
        title: "Entries deleted",
        description: `Successfully deleted ${entriesToDelete.length} entries`
      });
      setSelectedEntries(new Set());
      setShowDeleteDialog(false);

      // 쿼리 무효화하여 새로고침
      queryClient.invalidateQueries({
        queryKey: ['rankings']
      });
      queryClient.invalidateQueries({
        queryKey: ['wiki-trending-entries']
      });
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast({
        title: "Error",
        description: "Failed to delete entries",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // URL 파라미터에서 카테고리 설정
  useEffect(() => {
    if (category) {
      // URL에서 카테고리 형식: songs-top-100 -> schema:song
      const categoryName = category.replace('-top-100', '').replace(/-/g, ' ');
      // SCHEMA_TYPE_LABELS의 역매핑
      const schemaTypeEntry = Object.entries(SCHEMA_TYPE_LABELS).find(([_, label]) => label.toLowerCase() === categoryName.toLowerCase());
      if (schemaTypeEntry) {
        setSelectedCategory(`schema:${schemaTypeEntry[0]}`);
      } else {
        setSelectedCategory('all');
      }
    } else {
      setSelectedCategory('all');
    }
  }, [category]);

  // sortBy 변경 시 태그 관련 상태 초기화
  useEffect(() => {
    if (sortBy !== 'wiki-trending') {
      setShowPopularTags(false);
      setSelectedTag(null);
      setShowAllTags(false);
    }
  }, [sortBy]);

  // 카테고리 목록 가져오기 (캐싱)
  const {
    data: categories = []
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const categoryList: {
        id: string;
        title: string;
        type: 'entry' | 'schema';
      }[] = [];

      // 1. 개별 엔트리 (하위 엔트리를 가진 엔트리들)
      const {
        data: relationships
      } = await supabase.from('wiki_entry_relationships').select(`
          parent_entry_id,
          wiki_entries!wiki_entry_relationships_parent_entry_id_fkey (
            id,
            title
          )
        `);
      if (relationships) {
        const parentMap = new Map();
        relationships.forEach((rel: any) => {
          if (rel.wiki_entries && !parentMap.has(rel.parent_entry_id)) {
            parentMap.set(rel.parent_entry_id, {
              id: rel.wiki_entries.id,
              title: rel.wiki_entries.title,
              type: 'entry' as const
            });
          }
        });
        categoryList.push(...Array.from(parentMap.values()));
      }

      // 2. Schema Types - 실제 엔트리가 있는 스키마 타입만 가져오기
      const {
        data: schemaTypes
      } = await supabase.rpc('get_schema_types_with_entries');
      if (schemaTypes && schemaTypes.length > 0) {
        schemaTypes.forEach((row: any) => {
          const schemaType = row.schema_type;
          if (SCHEMA_TYPE_LABELS[schemaType]) {
            categoryList.push({
              id: `schema:${schemaType}`,
              title: SCHEMA_TYPE_LABELS[schemaType],
              type: 'schema' as const
            });
          }
        });
      }

      // 스키마 타입을 먼저, 그 다음 개별 엔트리, 각각 알파벳순 정렬
      categoryList.sort((a, b) => {
        if (a.type === b.type) {
          return a.title.localeCompare(b.title);
        }
        return a.type === 'schema' ? -1 : 1;
      });
      return categoryList;
    },
    staleTime: 10 * 60 * 1000 // 10분간 캐시 유지 (카테고리는 자주 안 바뀜)
  });

  // New 탭 데이터 (페이지네이션)
  const todayForNewPosts = new Date().toISOString().split('T')[0];
  const {
    data: posts = [],
    isLoading: postsLoading
  } = useQuery({
    queryKey: ['new-posts', newPage, selectedCategory, selectedTag, todayForNewPosts],
    queryFn: async () => {
      const {
        data: {
          user: authUser
        }
      } = await supabase.auth.getUser();
      const limit = 60;
      const offset = (newPage - 1) * limit;

      // 선택된 태그의 엔트리 ID 가져오기
      let tagEntryIds: string[] = [];
      if (selectedTag) {
        const {
          data: tagData
        } = await supabase.from('wiki_entry_tags').select('wiki_entry_id').eq('tag_id', selectedTag);
        tagEntryIds = (tagData || []).map(item => item.wiki_entry_id);
      }

      // 최신 posts 가져오기
      let postsQuery = supabase.from('posts').select(`
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
            schema_type,
            owner_id,
            creator_id
          )
        `).eq('is_approved', true).or('category.is.null,category.neq.announcement').order('created_at', {
        ascending: false
      });

      // 카테고리 필터 적용
      if (selectedCategory !== 'all') {
        if (selectedCategory.startsWith('schema:')) {
          const schemaType = selectedCategory.replace('schema:', '');
          postsQuery = postsQuery.filter('wiki_entries.schema_type', 'eq', schemaType);
        } else {
          // 개별 엔트리 필터
          postsQuery = postsQuery.eq('wiki_entry_id', selectedCategory);
        }
      }

      // 태그 필터 적용
      if (selectedTag && tagEntryIds.length > 0) {
        postsQuery = postsQuery.in('wiki_entry_id', tagEntryIds);
      }
      const {
        data: postsData
      } = await postsQuery.range(offset, offset + limit - 1);

      // 최신 wiki entries 가져오기
      let wikiQuery = supabase.from('wiki_entries').select(`
          id,
          title,
          slug,
          image_url,
          created_at,
          updated_at,
          votes,
          aggregated_votes,
          trending_score,
          aggregated_trending_score,
          metadata,
          schema_type,
          creator_id,
          profiles:creator_id (
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type
          )
        `).order('created_at', {
        ascending: false
      });

      // 카테고리 필터 적용
      if (selectedCategory !== 'all') {
        if (selectedCategory.startsWith('schema:')) {
          const schemaType = selectedCategory.replace('schema:', '') as any;
          wikiQuery = wikiQuery.eq('schema_type', schemaType);
        } else {
          // 개별 엔트리 필터 (하위 엔트리)
          const {
            data: childIds
          } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', selectedCategory);
          if (childIds && childIds.length > 0) {
            wikiQuery = wikiQuery.in('id', childIds.map(c => c.child_entry_id));
          } else {
            wikiQuery = wikiQuery.eq('id', selectedCategory);
          }
        }
      }

      // 태그 필터 적용
      if (selectedTag && tagEntryIds.length > 0) {
        wikiQuery = wikiQuery.in('id', tagEntryIds);
      }
      const {
        data: wikiData
      } = await wikiQuery.range(offset, offset + limit - 1);
      let userVotes: any[] = [];
      let userWikiVotes: any[] = [];
      let followedWikiIds: string[] = [];
      if (authUser) {
        const {
          data: votesData
        } = await supabase.from('post_votes').select('post_id, vote_type').eq('user_id', authUser.id);
        userVotes = votesData || [];
        const today = new Date().toISOString().split('T')[0];
        const {
          data: wikiVotesData
        } = await supabase.from('wiki_entry_votes').select('wiki_entry_id, vote_type').eq('user_id', authUser.id).eq('vote_date', today);
        userWikiVotes = wikiVotesData || [];

        // 팔로우 중인 wiki entry ID 가져오기
        const {
          data: followedEntries
        } = await supabase.from('wiki_entry_followers').select('wiki_entry_id').eq('user_id', authUser.id);
        followedWikiIds = followedEntries?.map(f => f.wiki_entry_id) || [];
      }
      const allPosts: Post[] = [];

      // Posts 처리
      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(post => post.id);
        const {
          data: commentCounts
        } = await supabase.from('comments').select('post_id').in('post_id', postIds);
        const commentCountMap = new Map<string, number>();
        commentCounts?.forEach(comment => {
          const count = commentCountMap.get(comment.post_id) || 0;
          commentCountMap.set(comment.post_id, count + 1);
        });
        postsData.forEach((post: any) => {
          const userVote = userVotes.find(v => v.post_id === post.id);
          // 팬 포스트 여부 확인: 운영자(=owner_id가 있으면 owner, 없으면 creator)를 제외한 작성자
          const operatorId = post.wiki_entries?.owner_id || post.wiki_entries?.creator_id;
          const isFanPost = !!post.wiki_entry_id && !!operatorId && post.user_id !== operatorId;
          allPosts.push({
            id: post.id,
            title: post.title,
            content: post.content,
            author: post.profiles?.display_name || post.profiles?.username || 'Unknown',
            category: post.category,
            votes: post.votes || 0,
            commentCount: commentCountMap.get(post.id) || 0,
            createdAt: new Date(post.created_at),
            updatedAt: new Date(post.updated_at || post.created_at),
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
            trendingScore: post.trending_score || 0,
            metadata: post.metadata,
            eventDate: post.event_date,
            isFollowing: post.wiki_entry_id ? followedWikiIds.includes(post.wiki_entry_id) : false,
            visibility: post.visibility,
            slug: post.slug,
            isFanPost: isFanPost
          });
        });
      }

      // Wiki entries를 Post 형식으로 변환
      if (wikiData && wikiData.length > 0) {
        // Wiki entry 코멘트 개수 가져오기
        const wikiIds = wikiData.map(wiki => wiki.id);
        const {
          data: wikiCommentCounts
        } = await supabase.from('comments').select('wiki_entry_id').in('wiki_entry_id', wikiIds).is('post_id', null);
        const wikiCommentCountMap = new Map<string, number>();
        wikiCommentCounts?.forEach(comment => {
          const count = wikiCommentCountMap.get(comment.wiki_entry_id) || 0;
          wikiCommentCountMap.set(comment.wiki_entry_id, count + 1);
        });
        wikiData.forEach((wiki: any) => {
          const userVote = userWikiVotes.find(v => v.wiki_entry_id === wiki.id);
          allPosts.push({
            id: `wiki-${wiki.id}`,
            title: wiki.title,
            content: '', // Wiki entries don't need content preview in list
            author: wiki.profiles?.display_name || wiki.profiles?.username || 'Unknown',
            category: 'Fanz',
            votes: wiki.votes || 0,
            commentCount: wikiCommentCountMap.get(wiki.id) || 0,
            createdAt: new Date(wiki.created_at),
            updatedAt: new Date(wiki.updated_at || wiki.created_at),
            userVote: userVote ? userVote.vote_type : null,
            imageUrl: wiki.image_url || wiki.metadata?.profile_image || wiki.metadata?.album_cover,
            sourceUrl: undefined,
            user_id: wiki.creator_id,
            communityId: undefined,
            communityName: undefined,
            communitySlug: undefined,
            communityIcon: undefined,
            authorAvatarUrl: wiki.profiles?.avatar_url,
            authorIsVerified: wiki.profiles?.is_verified,
            authorVerificationType: wiki.profiles?.verification_type,
            isPinned: false,
            isBoosted: false,
            boostedUntil: undefined,
            wikiEntryTitle: wiki.title,
            wikiEntryId: wiki.id,
            wikiEntrySlug: wiki.slug,
            trendingScore: wiki.trending_score || wiki.aggregated_trending_score || 0
          });
        });
      }

      // New 탭은 created_at 시간순으로 정렬 (최신 생성순)
      allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return allPosts.slice(0, 49);
    },
    enabled: sortBy === 'new',
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });

  // 인기 태그 가져오기
  const {
    data: popularTags = []
  } = useQuery({
    queryKey: ['popular-tags'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('wiki_tags').select('*').order('usage_count', {
        ascending: false
      }).limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000 // 5분간 캐시 유지
  });

  // 선택된 태그의 엔트리 ID 가져오기
  const {
    data: tagEntryIds = []
  } = useQuery({
    queryKey: ['tag-entry-ids', selectedTag],
    queryFn: async () => {
      if (!selectedTag) return [];
      const {
        data,
        error
      } = await supabase.from('wiki_entry_tags').select('wiki_entry_id').eq('tag_id', selectedTag);
      if (error) throw error;
      return (data || []).map(item => item.wiki_entry_id);
    },
    enabled: !!selectedTag,
    staleTime: 5 * 60 * 1000 // 5분간 캐시 유지
  });

  // Wiki Trending 데이터 (캐싱)
  const todayForCache = new Date().toISOString().split('T')[0];
  const {
    data: wikiTrendingEntries = [],
    isLoading: wikiTrendingLoading
  } = useQuery({
    queryKey: ['wiki-trending-entries', selectedCategory, selectedTag, tagEntryIds, searchQuery, schemaToggle, todayForCache],
    queryFn: async () => {
      let query;
      if (selectedCategory === 'all') {
        query = supabase.rpc('get_trending_wiki_entries').limit(60);
      } else if (selectedCategory.startsWith('schema:')) {
        const schemaType = selectedCategory.replace('schema:', '') as any;
        const {
          data: schemaEntries
        } = await supabase.from('wiki_entries').select('id').eq('schema_type', schemaType);
        const entryIds = schemaEntries?.map(e => e.id) || [];
        query = supabase.rpc('get_trending_wiki_entries').limit(60);
      } else {
        // 개별 엔트리의 하위 엔트리들
        const {
          data: childIds
        } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', selectedCategory);
        if (childIds && childIds.length > 0) {
          const entryIds = childIds.map(c => c.child_entry_id);
          query = supabase.rpc('get_trending_wiki_entries').limit(60);
        } else {
          query = supabase.rpc('get_trending_wiki_entries').limit(60);
        }
      }
      const {
        data,
        error
      } = (await query) as any;
      if (error) throw error;
      let filteredData = data || [];

      // 검색어 필터 적용
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter((entry: any) => entry.title.toLowerCase().includes(queryLower));
      }

      // 카테고리 필터 적용 (schema type 또는 개별 엔트리)
      if (selectedCategory !== 'all') {
        if (selectedCategory.startsWith('schema:')) {
          const schemaType = selectedCategory.replace('schema:', '');
          filteredData = filteredData.filter((entry: any) => entry.schema_type === schemaType);
        } else {
          // 개별 엔트리의 하위 엔트리들
          const {
            data: childIds
          } = await supabase.from('wiki_entry_relationships').select('child_entry_id').eq('parent_entry_id', selectedCategory);
          if (childIds && childIds.length > 0) {
            const entryIds = childIds.map(c => c.child_entry_id);
            filteredData = filteredData.filter((entry: any) => entryIds.includes(entry.id));
          } else {
            filteredData = filteredData.filter((entry: any) => entry.id === selectedCategory);
          }
        }
      }

      // 태그 필터 적용
      if (selectedTag && tagEntryIds.length > 0) {
        filteredData = filteredData.filter((entry: any) => tagEntryIds.includes(entry.id));
      }

      // 아티스트/멤버/배우 토글 필터 적용 (Wiki Trending 탭)
      filteredData = filteredData.filter((entry: any) => entry.schema_type === schemaToggle);

      // 토큰 정보 및 owner_id, page_status 추가 조회
      const entryIds = filteredData.map((e: any) => e.id);
      if (entryIds.length > 0) {
        const [{
          data: tokens
        }, {
          data: ownerData
        }] = await Promise.all([supabase.from('fanz_tokens').select('id, wiki_entry_id').in('wiki_entry_id', entryIds).eq('is_active', true), supabase.from('wiki_entries').select('id, owner_id, page_status').in('id', entryIds)]);
        const tokenMap = new Map(tokens?.map(t => [t.wiki_entry_id, t]) || []);
        const ownerDataMap = new Map(ownerData?.map(o => [o.id, {
          owner_id: o.owner_id,
          page_status: o.page_status
        }]) || []);
        let resultData = filteredData.map((entry: any) => ({
          ...entry,
          owner_id: ownerDataMap.get(entry.id)?.owner_id || null,
          page_status: ownerDataMap.get(entry.id)?.page_status || 'unclaimed',
          fanz_tokens: tokenMap.get(entry.id) ? [tokenMap.get(entry.id)] : []
        }));

        // 소유권이 이전된 페이지(owner_id가 있는)를 상단에 배치
        // 정렬 우선순위: 1) 응원봉 거래 열림 (fanz_tokens) 2) 1000표 이상 3) 나머지 (trending_score 순)
        resultData.sort((a: any, b: any) => {
          const aHasFanzToken = a.fanz_tokens && a.fanz_tokens.length > 0;
          const bHasFanzToken = b.fanz_tokens && b.fanz_tokens.length > 0;
          const aVotes = a.votes || 0;
          const bVotes = b.votes || 0;
          const aOver1000 = aVotes >= 1000;
          const bOver1000 = bVotes >= 1000;

          // 1순위: 응원봉 거래 열림
          if (aHasFanzToken && !bHasFanzToken) return -1;
          if (!aHasFanzToken && bHasFanzToken) return 1;

          // 2순위: 1000표 이상
          if (aOver1000 && !bOver1000) return -1;
          if (!aOver1000 && bOver1000) return 1;

          // 3순위: trending_score
          return (b.trending_score || 0) - (a.trending_score || 0);
        });
        return resultData.slice(0, 49);
      }
      return filteredData.slice(0, 49);
    },
    enabled: sortBy === 'wiki-trending',
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });

  // Rankings 데이터 (캐싱)
  const {
    data: rankings = [],
    isLoading: rankingsLoading
  } = useQuery({
    queryKey: ['rankings', sortBy, selectedCategory, selectedTag, tagEntryIds, searchQuery, schemaToggle, todayForCache],
    queryFn: async () => {
      let wikis;

      // 정렬 기준 필드
      const orderField = 'trending_score';

      // 검색어가 있을 때는 전체 DB에서 제목 기준으로만 검색 (내용/스키마 필터 제거)
      if (searchQuery.trim()) {
        let searchQueryBuilder = supabase.from('wiki_entries').select(`
            id,
            title,
            slug,
            trending_score,
            votes,
            aggregated_votes,
            aggregated_trending_score,
            view_count,
            follower_count,
            image_url,
            metadata,
            created_at,
            page_status,
            schema_type,
            profiles:creator_id (
              username,
              avatar_url
            ),
            fanz_tokens (id),
            entry_community_funds (total_fund)
          `).ilike('title', `%${searchQuery.trim()}%`).order(orderField, {
          ascending: false
        });

        // 카테고리 필터만 유지 (schema: 타입 선택 시)
        if (selectedCategory !== 'all' && selectedCategory.startsWith('schema:')) {
          const schemaType = selectedCategory.replace('schema:', '') as any;
          searchQueryBuilder = searchQueryBuilder.eq('schema_type', schemaType);
        }
        const {
          data
        } = await searchQueryBuilder;
        wikis = data;
      } else if (selectedCategory === 'all') {
        // 전체 엔트리 가져오기 (KTRENDZ 탭 기본)
        let baseQuery = supabase.from('wiki_entries').select(`
            id,
            title,
            slug,
            trending_score,
            votes,
            aggregated_votes,
            aggregated_trending_score,
            view_count,
            follower_count,
            image_url,
            metadata,
            created_at,
            page_status,
            schema_type,
            profiles:creator_id (
              username,
              avatar_url
            ),
            fanz_tokens (id),
            entry_community_funds (total_fund)
          `).not('page_status', 'eq', 'pending').order(orderField, {
          ascending: false
        });

        // 아티스트/멤버/배우 토글을 DB 쿼리에서 직접 적용 (전체 카테고리일 때)
        if (sortBy !== 'new' && selectedCategory === 'all') {
          baseQuery = baseQuery.eq('schema_type', schemaToggle);
        }
        const {
          data
        } = await baseQuery.limit(60);
        wikis = data;
      } else if (selectedCategory.startsWith('schema:')) {
        // Schema Type 선택
        const schemaType = selectedCategory.replace('schema:', '') as any;
        const {
          data
        } = await supabase.from('wiki_entries').select(`
            id,
            title,
            slug,
            trending_score,
            votes,
            aggregated_votes,
            aggregated_trending_score,
            view_count,
            follower_count,
            image_url,
            metadata,
            created_at,
            page_status,
            schema_type,
            profiles:creator_id (
              username,
              avatar_url
            ),
            fanz_tokens (id),
            entry_community_funds (total_fund)
          `).eq('schema_type', schemaType).not('page_status', 'eq', 'pending').order(orderField, {
          ascending: false
        }).limit(60);
        wikis = data;
      } else {
        // 개별 엔트리 선택: parent와 하위 엔트리들
        const {
          data: relationships
        } = await supabase.from('wiki_entry_relationships').select(`
            parent_entry_id,
            child_entry_id,
            wiki_entries!wiki_entry_relationships_parent_entry_id_fkey (
              id,
              title,
              slug,
              trending_score,
              votes,
              aggregated_votes,
              aggregated_trending_score,
              view_count,
              follower_count,
              image_url,
              metadata,
              page_status,
              profiles:creator_id (
                username,
                avatar_url
              )
            ),
            child_wiki_entries:wiki_entries!wiki_entry_relationships_child_entry_id_fkey (
              id,
              title,
              slug,
              trending_score,
              votes,
              aggregated_votes,
              aggregated_trending_score,
              view_count,
              follower_count,
              image_url,
              metadata,
              page_status,
              profiles:creator_id (
                username,
                avatar_url
              )
            )
          `).eq('parent_entry_id', selectedCategory);
        if (relationships && relationships.length > 0) {
          const parentEntry = relationships[0].wiki_entries;
          // page_status가 pending이 아닌 엔트리만 필터링
          const childEntries = relationships.map((rel: any) => rel.child_wiki_entries).filter((entry: any) => entry && entry.page_status !== 'pending');
          const allEntries = [];
          if (parentEntry && parentEntry.page_status !== 'pending') {
            allEntries.push(parentEntry);
          }
          allEntries.push(...childEntries);
          wikis = allEntries.sort((a: any, b: any) => {
            return (b[orderField] || 0) - (a[orderField] || 0);
          });
        }
      }

      // 태그 필터 적용
      if (wikis && selectedTag && tagEntryIds.length > 0) {
        wikis = wikis.filter((wiki: any) => tagEntryIds.includes(wiki.id));
      }

      // 아티스트/멤버/배우 토글 필터 적용 (Best 탭에서만, new 제외, 개별 카테고리 선택 시)
      if (wikis && sortBy !== 'new' && selectedCategory !== 'all') {
        wikis = wikis.filter((wiki: any) => wiki.schema_type === schemaToggle);
      }

      // 검색어가 없을 때만 49개로 제한 (검색 시에는 전체 결과 노출)
      if (wikis && !searchQuery.trim()) {
        wikis = wikis.slice(0, 49);
      }
      if (wikis) {
        // fanz_tokens에서 응원봉 수량 가져오기
        const wikiIds = wikis.map((wiki: any) => wiki.id);
        const {
          data: fanzTokens
        } = await supabase.from('fanz_tokens').select('wiki_entry_id, total_supply').in('wiki_entry_id', wikiIds);
        const tokenSupplyMap = new Map();
        if (fanzTokens) {
          fanzTokens.forEach((token: any) => {
            tokenSupplyMap.set(token.wiki_entry_id, token.total_supply);
          });
        }
        let resultData = wikis.map((wiki: any) => ({
          ...wiki,
          type: 'wiki' as const,
          creator: wiki.profiles,
          image_url: wiki.image_url || wiki.metadata?.profile_image || wiki.metadata?.album_cover,
          fanz_token_supply: tokenSupplyMap.get(wiki.id) || 0
        }));

        // 정렬 우선순위: 1) 응원봉 거래 열림 (fanz_tokens) 2) 1000표 이상 3) 나머지 (trending_score 순)
        resultData.sort((a: any, b: any) => {
          const aHasFanzToken = a.fanz_tokens && a.fanz_tokens.length > 0;
          const bHasFanzToken = b.fanz_tokens && b.fanz_tokens.length > 0;
          const aVotes = a.votes || 0;
          const bVotes = b.votes || 0;
          const aOver1000 = aVotes >= 1000;
          const bOver1000 = bVotes >= 1000;

          // 1순위: 응원봉 거래 열림
          if (aHasFanzToken && !bHasFanzToken) return -1;
          if (!aHasFanzToken && bHasFanzToken) return 1;

          // 2순위: 1000표 이상
          if (aOver1000 && !bOver1000) return -1;
          if (!aOver1000 && bOver1000) return 1;

          // 3순위: trending_score
          return (b.trending_score || 0) - (a.trending_score || 0);
        });
        return resultData;
      }
      return [];
    },
    enabled: sortBy === 'trending',
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });

  // 2군/3군 랜덤 엔트리 선택 - 페이지 로딩 시마다 새롭게
  useEffect(() => {
    if (rankings.length > 5) {
      const tier2And3 = rankings.slice(5);
      const shuffled = [...tier2And3].sort(() => Math.random() - 0.5);
      setRandomEntries(shuffled.slice(0, 10));
    }
  }, [rankings]);
  const loading = sortBy === 'new' ? postsLoading : sortBy === 'wiki-trending' ? wikiTrendingLoading : rankingsLoading;

  // 투표 핸들러
  const handleVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const isWikiEntry = postId.startsWith("wiki-");
    const actualId = isWikiEntry ? postId.replace("wiki-", "") : postId;
    const oldUserVote = post.userVote;
    const newUserVote: "up" | "down" | null = oldUserVote === type ? null : type;

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = oldUserVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const isVoteSwitch = oldUserVote !== null && newUserVote !== null && oldUserVote !== newUserVote;

    // 새 투표만 에너지 체크 (취소나 전환은 제외)
    if (!isUnvoting && !isVoteSwitch) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const {
          data: voteCheck,
          error: checkError
        } = await supabase.rpc('check_and_increment_vote_count', {
          user_id_param: user.id,
          target_id_param: actualId,
          target_type_param: isWikiEntry ? 'wiki_entry' : 'post'
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
            variant: "destructive"
          });
          return;
        }
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
            description: `You earned bonus points for using all ${checkData.max_votes} energy today!`
          });

          // 데일리 토큰 민팅 (supabase.functions.invoke가 자동으로 인증 토큰 포함)
          try {
            const {
              data: mintData,
              error: mintError
            } = await supabase.functions.invoke('mint-daily-tokens');
            if (mintError) {
              console.error('Token mint error:', mintError);
              const errorData = mintError as any;

              // 지갑이 없는 경우
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
                description: `You received ${mintData.amount} KTNZ tokens!`
              });
            }
          } catch (error) {
            console.error('Failed to mint daily tokens:', error);
          }
        } else {
          toast({
            title: "Vote counted",
            description: `Energy ${checkData.max_votes - checkData.remaining_votes}/${checkData.max_votes} used today`
          });
        }
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

    // 즉시 반영되도록 낙관적 업데이트
    let voteDelta = 0;
    if (newUserVote === null) {
      // 같은 버튼 다시 눌러서 투표 취소
      voteDelta = type === "up" ? -1 : 1;
    } else if (!oldUserVote) {
      // 새 투표
      voteDelta = type === "up" ? 1 : -1;
    } else {
      // 투표 종류 변경
      voteDelta = type === "up" ? 2 : -2;
    }

    // 현재 탭에 따라 적절한 쿼리 업데이트 (쿼리 키 일치 필수)
    const newPostsKey = ['new-posts', newPage, selectedCategory, selectedTag];
    const rankingsKey = ['rankings', selectedCategory, searchQuery];
    const wikiTrendingKey = ['wiki-trending-entries', selectedCategory, selectedTag, tagEntryIds, searchQuery];
    const previousNewPosts = queryClient.getQueryData<Post[]>(newPostsKey);
    const previousRankings = queryClient.getQueryData<RankingItem[]>(rankingsKey);
    const previousWikiTrending = queryClient.getQueryData<any[]>(wikiTrendingKey);

    // New 탭 업데이트
    queryClient.setQueryData<Post[]>(newPostsKey, old => {
      if (!old) return old;
      return old.map(p => p.id === postId ? {
        ...p,
        votes: p.votes + voteDelta,
        userVote: newUserVote
      } : p);
    });

    // Trending 탭 업데이트 (wiki 엔트리)
    if (isWikiEntry) {
      queryClient.setQueryData<RankingItem[]>(rankingsKey, old => {
        if (!old) return old;
        return old.map(item => item.id === actualId ? {
          ...item,
          votes: (item.votes || 0) + voteDelta
        } : item);
      });

      // Wiki Trending 탭 업데이트
      queryClient.setQueryData<any[]>(wikiTrendingKey, old => {
        if (!old) return old;
        return old.map((item: any) => item.id === actualId ? {
          ...item,
          votes: (item.votes || 0) + voteDelta
        } : item);
      });
    }
    try {
      if (isWikiEntry) {
        // 위키 엔트리 투표 처리
        const today = new Date().toISOString().split('T')[0];
        if (newUserVote === null) {
          await supabase.from('wiki_entry_votes').delete().eq('wiki_entry_id', actualId).eq('user_id', user.id).eq('vote_date', today);
        } else if (oldUserVote === null) {
          await supabase.from('wiki_entry_votes').insert({
            wiki_entry_id: actualId,
            user_id: user.id,
            vote_type: newUserVote,
            vote_date: today
          });
        } else {
          await supabase.from('wiki_entry_votes').update({
            vote_type: newUserVote
          }).eq('wiki_entry_id', actualId).eq('user_id', user.id).eq('vote_date', today);
        }
      } else {
        // 일반 포스트 투표 처리
        if (newUserVote === null) {
          await supabase.from('post_votes').delete().eq('post_id', actualId).eq('user_id', user.id);
        } else if (oldUserVote === null) {
          await supabase.from('post_votes').insert({
            post_id: actualId,
            user_id: user.id,
            vote_type: newUserVote
          });
        } else {
          await supabase.from('post_votes').update({
            vote_type: newUserVote
          }).eq('post_id', actualId).eq('user_id', user.id);
        }
      }

      // 온체인 투표 기록 (위키 엔트리 upvote인 경우만, 관리자 제외)
      if (isWikiEntry && newUserVote === 'up' && oldUserVote !== 'up' && !isAdmin) {
        const today = new Date().toISOString().split('T')[0];
        try {
          // wikiTrendingEntries에서 엔트리 타이틀 찾기
          const entryData = wikiTrendingEntries?.find((e: any) => e.id === actualId);
          const entryTitle = entryData?.title || 'Unknown Entry';
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
          console.log('[Rankings] On-chain vote recorded for entry:', entryTitle, onchainResult);
          
          // tx_hash를 wiki_entry_votes에 저장
          if (onchainResult?.txHash) {
            await supabase
              .from('wiki_entry_votes')
              .update({ tx_hash: onchainResult.txHash })
              .eq('wiki_entry_id', actualId)
              .eq('user_id', user.id)
              .eq('vote_date', today);
          }
        } catch (onchainError) {
          console.error('[Rankings] On-chain vote recording failed:', onchainError);
        }
      }

      // Navbar 에너지 표시 갱신
      window.dispatchEvent(new CustomEvent('dailyVotesUpdated'));
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });

      // 낙관적 업데이트 롤백
      queryClient.setQueryData<Post[] | undefined>(newPostsKey, () => previousNewPosts);
      queryClient.setQueryData<RankingItem[] | undefined>(rankingsKey, () => previousRankings);
      queryClient.setQueryData<any[] | undefined>(wikiTrendingKey, () => previousWikiTrending);
    }
  };

  // 태그 펼침 로직
  useEffect(() => {
    if (showPopularTags && tagsRef.current && popularTags && popularTags.length > 0) {
      const checkHeight = () => {
        if (tagsRef.current) {
          const firstTag = tagsRef.current.querySelector('button');
          if (firstTag) {
            const tagHeight = firstTag.offsetHeight;
            const gap = 8; // gap-2 = 0.5rem = 8px
            const threeRowsHeight = tagHeight * 3 + gap * 2; // 3줄 + 2개의 gap

            tagsRef.current.style.maxHeight = 'none';
            const scrollHeight = tagsRef.current.scrollHeight;
            setNeedsExpand(scrollHeight > threeRowsHeight);
            if (!showAllTags) {
              tagsRef.current.style.maxHeight = `${threeRowsHeight}px`;
            }
          }
        }
      };
      // 약간의 딜레이를 주어 렌더링 완료 후 체크
      setTimeout(checkHeight, 100);
      window.addEventListener('resize', checkHeight);
      return () => window.removeEventListener('resize', checkHeight);
    }
  }, [popularTags, showAllTags, showPopularTags]);

  // SEO 데이터 생성
  const getSEOData = () => {
    const categoryData = categories.find(c => c.id === selectedCategory);
    const categoryTitle = categoryData?.title || 'All';
    if (selectedCategory === 'all') {
      return {
        title: 'KTRENDZ: K-Pop, K-Culture Fan Community',
        description: 'Discover the top 100 trending K-Pop artists, groups, K-actors, albums, dramas, and more. Real-time KTrendz based on fan votes, engagement, and trending scores.',
        keywords: 'kpop ranking, kpop top 100, kpop artists ranking, kpop groups ranking, korean actors ranking, kdrama ranking, kpop popularity ranking',
        canonicalUrl: 'https://k-trendz.com/rankings'
      };
    }
    const categoryLower = categoryTitle.toLowerCase();
    return {
      title: 'KTRENDZ: K-Pop, K-Culture Fan Community',
      description: `Explore the top 100 ${categoryLower} ranked by trending score, fan votes, and engagement. Updated in real-time by the K-Pop community worldwide.`,
      keywords: `${categoryLower} ranking, top 100 ${categoryLower}, ${categoryLower} popularity, kpop ${categoryLower}, korean ${categoryLower}`,
      canonicalUrl: category ? `https://k-trendz.com/${category}` : 'https://k-trendz.com/rankings'
    };
  };
  const seoData = getSEOData();

  // 카테고리 필터 페이지인지 확인
  const isCategoryPage = !!category;
  const categoryLabel = isCategoryPage ? Object.entries(SCHEMA_TYPE_LABELS).find(([key]) => selectedCategory === `schema:${key}`)?.[1] || "Entries" : null;
  return <>
      <Helmet>
        <title>{seoData.title}</title>
        <meta name="description" content={seoData.description} />
        <meta name="keywords" content={seoData.keywords} />
        <link rel="canonical" href={seoData.canonicalUrl} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={seoData.canonicalUrl} />
        <meta property="og:title" content={seoData.title} />
        <meta property="og:description" content={seoData.description} />
        <meta property="og:site_name" content="KTRENDZ" />
        <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoData.title} />
        <meta name="twitter:description" content={seoData.description} />
        <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png" />
        
        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": seoData.title,
          "description": seoData.description,
          "url": seoData.canonicalUrl,
          "publisher": {
            "@type": "Organization",
            "name": "KTRENDZ",
            "logo": "https://auth.ktrendz.xyz/storage/v1/object/public/brand_assets/logo_7.png"
          }
        })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {!isCategoryPage && <Navbar />}
        
        {/* Challenge Banner - 헤더 바로 아래 */}
        {!isCategoryPage && rankingsBannerSettings?.url && <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-7">
            {rankingsBannerSettings.linkEnabled ? <Link to={rankingsBannerSettings.link || '/challenges'} className="block relative overflow-hidden group rounded-lg">
                <img src={rankingsBannerSettings.url} alt="KTRENDZ challenge banner" className="w-full h-[100px] sm:h-28 md:h-40 object-cover hover:opacity-90 transition-opacity rounded-lg" />
                {/* Twinkling sparkle stars overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(10)].map((_, i) => <div key={i} className="absolute animate-twinkle" style={{
              left: `${8 + i * 9 % 84}%`,
              top: `${12 + i * 17 % 76}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2 + i % 3 * 0.7}s`
            }}>
                      {/* 4-point star sparkle */}
                      <svg width="10" height="10" viewBox="0 0 24 24" className="text-white/60">
                        <path fill="currentColor" d="M12 0L13.5 9L22 12L13.5 15L12 24L10.5 15L2 12L10.5 9L12 0Z" />
                      </svg>
                    </div>)}
                </div>
              </Link> : <div className="block relative overflow-hidden rounded-lg">
                <img src={rankingsBannerSettings.url} alt="KTRENDZ challenge banner" className="w-full h-[100px] sm:h-28 md:h-40 object-cover rounded-lg" />
                {/* Twinkling sparkle stars overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(10)].map((_, i) => <div key={i} className="absolute animate-twinkle" style={{
              left: `${8 + i * 9 % 84}%`,
              top: `${12 + i * 17 % 76}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2 + i % 3 * 0.7}s`
            }}>
                      {/* 4-point star sparkle */}
                      <svg width="10" height="10" viewBox="0 0 24 24" className="text-white/60">
                        <path fill="currentColor" d="M12 0L13.5 9L22 12L13.5 15L12 24L10.5 15L2 12L10.5 9L12 0Z" />
                      </svg>
                    </div>)}
                </div>
              </div>}
          </div>}
        
        {isCategoryPage && <div className="border-b border-border bg-background sticky top-0 z-40">
            <div className="container mx-auto px-4 py-4 flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">{categoryLabel}</h1>
            </div>
          </div>}
        
        <main className={`container mx-auto px-4 md:px-6 lg:px-8 pb-8 max-w-5xl ${isCategoryPage ? 'pt-4' : 'pt-0'}`}>
          
          
          {/* 응원봉 티커 - 끊김 없는 무한 루프 */}
          {!isCategoryPage && tickerData.length > 0 && (
            <div className="mt-3 mb-1 overflow-hidden -mx-4 md:-mx-6 lg:-mx-8 bg-muted/30">
              <div className="flex whitespace-nowrap py-1 animate-marquee-seamless">
                {/* 첫 번째 세트 */}
                {tickerData.map((item, index) => {
                  const priceChange = (item.totalSupply === 0 || !item.todayFirstPrice) 
                    ? 0 
                    : ((item.currentPrice - item.todayFirstPrice) / item.todayFirstPrice * 100);
                  const isPositive = priceChange >= 0;
                  return (
                    <Link 
                      key={`${item.slug}-${index}`} 
                      to={`/k/${item.slug}`} 
                      onClick={e => {
                        if (shouldBlockMemberActor) {
                          e.preventDefault();
                          showMemberActorComingSoon();
                        }
                      }} 
                      className="inline-flex items-center gap-2 mx-6 hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                      <span className="text-sm flex-shrink-0">🪄</span>
                      <span className="text-xs font-medium truncate max-w-[100px] text-muted-foreground">{item.title}</span>
                      <span className="text-xs font-semibold text-muted-foreground">${item.currentPrice.toFixed(2)}</span>
                      <span className={cn("text-[10px] font-medium", isPositive ? "text-green-500" : "text-red-500")}>
                        {isPositive ? "+" : ""}{priceChange.toFixed(1)}%
                      </span>
                    </Link>
                  );
                })}
                {/* 복제된 세트 - 끊김 없는 루프를 위해 */}
                {tickerData.map((item, index) => {
                  const priceChange = (item.totalSupply === 0 || !item.todayFirstPrice) 
                    ? 0 
                    : ((item.currentPrice - item.todayFirstPrice) / item.todayFirstPrice * 100);
                  const isPositive = priceChange >= 0;
                  return (
                    <Link 
                      key={`${item.slug}-dup-${index}`} 
                      to={`/k/${item.slug}`} 
                      onClick={e => {
                        if (shouldBlockMemberActor) {
                          e.preventDefault();
                          showMemberActorComingSoon();
                        }
                      }} 
                      className="inline-flex items-center gap-2 mx-6 hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                      <span className="text-sm flex-shrink-0">🪄</span>
                      <span className="text-xs font-medium truncate max-w-[100px] text-muted-foreground">{item.title}</span>
                      <span className="text-xs font-semibold text-muted-foreground">${item.currentPrice.toFixed(2)}</span>
                      <span className={cn("text-[10px] font-medium", isPositive ? "text-green-500" : "text-red-500")}>
                        {isPositive ? "+" : ""}{priceChange.toFixed(1)}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Buttons & Search */}
          {!isCategoryPage && <div className="mb-4 md:mb-6">
            {/* Schema Toggle Tabs with Search Button */}
            <div className="flex items-center justify-center gap-2 mt-4 mb-3">
              <div className="inline-flex bg-white rounded-full p-1 shadow-sm">
                <button onClick={() => setSchemaToggle('artist')} className={cn("px-4 py-1.5 text-sm font-medium rounded-full transition-all", schemaToggle === 'artist' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  Artists
                </button>
                <button onClick={() => {
                if (!isAdmin && !isAdminLoading) {
                  showMemberActorComingSoon();
                  return;
                }
                setSchemaToggle('member');
              }} className={cn("px-4 py-1.5 text-sm font-medium rounded-full transition-all", schemaToggle === 'member' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  Members
                </button>
                <button onClick={() => {
                if (!isAdmin && !isAdminLoading) {
                  showMemberActorComingSoon();
                  return;
                }
                setSchemaToggle('actor');
              }} className={cn("px-4 py-1.5 text-sm font-medium rounded-full transition-all", schemaToggle === 'actor' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  Actors
                </button>
              </div>
              {/* Search Button */}
              <button onClick={() => setIsSearchExpanded(!isSearchExpanded)} className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", isSearchExpanded || searchQuery ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                <Search className="w-4 h-4" />
              </button>
            </div>
            
            {/* Expandable Search Input */}
            {isSearchExpanded && <div className="relative max-w-md mx-auto mb-3 animate-fade-in">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search KTrendz..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-10 h-10 text-sm rounded-full" autoFocus />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/40 flex items-center justify-center hover:bg-muted-foreground/60 transition-colors">
                    <span className="text-white text-xs font-medium leading-none">✕</span>
                  </button>}
              </div>}
          </div>}

          {/* Popular Tags Cloud */}
          {!searchQuery && popularTags.length > 0 && showPopularTags && <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TagIcon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Popular Tags</h3>
                {selectedTag && <Button variant="ghost" size="sm" onClick={() => setSelectedTag(null)} className="ml-auto h-6 px-2 text-xs">
                    Clear Filter
                  </Button>}
              </div>
              <div ref={tagsRef} className={`flex flex-wrap gap-2 overflow-hidden transition-all duration-300 ${showAllTags ? '' : ''}`}>
                {popularTags.map(tag => <button key={tag.id} type="button" onClick={() => {
              setSelectedTag(selectedTag === tag.id ? null : tag.id);
            }} className={`inline-flex items-center justify-center rounded-full px-3 h-10 text-xs font-medium transition-colors ${selectedTag === tag.id ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                    {tag.name} ({tag.usage_count})
                  </button>)}
              </div>
              {needsExpand && <Button variant="ghost" size="sm" onClick={() => setShowAllTags(!showAllTags)} className="mt-2 w-full rounded-full gap-2 text-xs sm:text-sm text-muted-foreground">
                  {showAllTags ? <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less
                    </> : <>
                      <ChevronDown className="w-4 h-4" />
                      Show More
                    </>}
                </Button>}
            </div>}

          {/* Filters */}
          <div className="flex justify-center items-center mb-4 md:mb-5">
            {/* Category Filter - Hidden temporarily */}
            <div className="hidden">
              <Popover open={open} onOpenChange={isOpen => {
              setOpen(isOpen);
              if (isOpen && categoryButtonRef.current) {
                // 드롭다운이 열릴 때 버튼을 네비게이션 바로 아래로 스크롤
                setTimeout(() => {
                  const buttonRect = categoryButtonRef.current?.getBoundingClientRect();
                  if (buttonRect) {
                    const scrollTop = window.pageYOffset + buttonRect.top - 80; // 네비게이션 높이만큼 여백
                    window.scrollTo({
                      top: scrollTop,
                      behavior: 'smooth'
                    });
                  }
                }, 100);
              }
            }}>
                <PopoverTrigger asChild>
                  <Button ref={categoryButtonRef} variant="outline" role="combobox" aria-expanded={open} className="w-full md:w-[280px] justify-between h-10 text-sm">
                    {selectedCategory === 'all' ? "All Categories" : categories.find(category => category.id === selectedCategory)?.title || "Select Category"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] md:w-[280px] p-0 max-h-[80vh]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search category..." autoFocus={false} />
                    <CommandList className="max-h-[75vh] overflow-y-auto" onTouchStart={() => {
                    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
                    if (input) input.blur();
                  }}>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup heading="All">
                        <CommandItem value="all" onSelect={() => {
                        setSelectedCategory('all');
                        navigate('/rankings');
                        setOpen(false);
                      }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedCategory === 'all' ? "opacity-100" : "opacity-0")} />
                          All Categories
                        </CommandItem>
                      </CommandGroup>
                      {categories.filter(c => c.type === 'schema').length > 0 && <CommandGroup heading="Categories">
                          {categories.filter(c => c.type === 'schema').sort((a, b) => a.title.localeCompare(b.title)).map(category => <CommandItem key={category.id} value={category.title} onSelect={() => {
                        setSelectedCategory(category.id);
                        const urlPath = category.title.toLowerCase().replace(/\s+/g, '-') + '-top-100';
                        navigate(`/${urlPath}`);
                        setOpen(false);
                      }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedCategory === category.id ? "opacity-100" : "opacity-0")} />
                                {category.title}
                              </CommandItem>)}
                        </CommandGroup>}
                      {categories.filter(c => c.type === 'entry').length > 0 && <CommandGroup heading="Entries">
                          {categories.filter(c => c.type === 'entry').sort((a, b) => a.title.localeCompare(b.title)).map(category => <CommandItem key={category.id} value={category.title} onSelect={() => {
                        setSelectedCategory(category.id);
                        navigate('/rankings');
                        setOpen(false);
                      }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedCategory === category.id ? "opacity-100" : "opacity-0")} />
                                {category.title}
                              </CommandItem>)}
                        </CommandGroup>}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sort Tabs - 당분간 숨김 처리 */}
            {/* <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)} defaultValue="new" className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-3 md:w-[420px] lg:w-auto h-11 md:h-10">
                <TabsTrigger
                  value="trending"
                  className="flex items-center gap-1 text-xs md:text-sm px-3 md:px-4 h-full hover:text-primary data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:opacity-50"
                >
                  <Trophy className="w-4 h-4 md:w-4 md:h-4" />
                  <span>Best</span>
                </TabsTrigger>
                <TabsTrigger
                  value="wiki-trending"
                  className="flex items-center gap-1 text-xs md:text-sm px-3 md:px-4 h-full hover:text-primary data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:opacity-50"
                >
                  <TrendingUp className="w-4 h-4 md:w-4 md:h-4" />
                  <span>Trend</span>
                </TabsTrigger>
                <TabsTrigger
                  value="new"
                  className="flex items-center gap-1 text-xs md:text-sm px-3 md:px-4 h-full hover:text-primary data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:opacity-50"
                >
                  <Clock className="w-4 h-4 md:w-4 md:h-4" />
                  <span>New</span>
                </TabsTrigger>
              </TabsList>
             </Tabs> */}
          </div>

          {/* Rankings List */}
          <div>
            {loading ? <div className="flex flex-col items-center justify-center py-20">
                <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Loading...
                </div>
              </div> : sortBy === 'new' ?
          // New 탭: 베스트 탭 하단과 같은 그리드 카드 형태
          posts.length === 0 ? <div className="p-12 text-center bg-card rounded-lg">
                  <p className="text-muted-foreground">No posts available</p>
                </div> : <>
                  <div className="grid grid-cols-1 gap-4">
                    {posts.filter(post => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                // content removed from search for performance
                return post.title.toLowerCase().includes(query) || post.author.toLowerCase().includes(query);
              }).map(post => {
                const displayImage = post.imageUrl;
                const timeAgo = (dateString: string | Date) => {
                  const now = new Date();
                  const date = new Date(dateString);
                  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
                  if (seconds < 60) return `${seconds}s`;
                  const minutes = Math.floor(seconds / 60);
                  if (minutes < 60) return `${minutes}m`;
                  const hours = Math.floor(minutes / 60);
                  if (hours < 24) return `${hours}h`;
                  const days = Math.floor(hours / 24);
                  if (days < 7) return `${days}d`;
                  const weeks = Math.floor(days / 7);
                  return `${weeks}w`;
                };

                // 이미지 블러 처리 여부 확인 (포스트 공개설정 기준)
                const shouldBlurImage = (): boolean => {
                  // 관리자는 블러 처리 우회
                  if (isAdmin) return false;
                  const visibility = post.visibility || 'public';
                  if (visibility === 'fans_only') {
                    // 비로그인 사용자는 블러 처리
                    if (!user) return true;
                    return !post.isFollowing;
                  }
                  return false;
                };
                const imageBlurred = shouldBlurImage();

                // 블러 이유 메시지
                const getBlurReason = (): string => {
                  const visibility = post.visibility || 'public';
                  if (visibility === 'fans_only') return 'Fans Only';
                  return '';
                };

                // wiki entry인지 post인지 구분
                const isWikiEntry = post.id.startsWith('wiki-');
                const linkTo = isWikiEntry ? `/k/${post.wikiEntrySlug}` : post.slug ? `/p/${post.slug}` : `/post/${post.id}`;

                // 팬 포스트는 가로형 카드
                if (post.isFanPost) {
                  return <Link key={post.id} to={linkTo} className="group flex flex-row bg-card rounded-lg overflow-hidden h-36 md:h-64">
                            <div className="relative w-28 h-36 md:w-72 md:h-64 flex-shrink-0 bg-muted">
                              <SmartImage
                                src={getCardThumbnail(displayImage) || displayImage}
                                alt={post.title}
                                rootMargin="600px"
                                className={cn("w-full h-full object-cover", imageBlurred && "blur-xl")}
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <FileText className="w-8 h-8" />
                                  </div>
                                }
                              />
                              {imageBlurred && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                  <Lock className="w-4 h-4 text-white/80" />
                                </div>}
                            </div>
                            <div className="p-2 md:p-4 flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Avatar className="w-4 h-4 flex-shrink-0">
                                  <AvatarImage src={getAvatarThumbnail(post.authorAvatarUrl, 32) || post.authorAvatarUrl} />
                                  <AvatarFallback className="text-[8px]">
                                    {(post.author || 'U')[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                                  {post.author || 'Unknown'}
                                  {post.authorIsVerified && <Verified className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                                </span>
                                {post.wikiEntryTitle && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto flex-shrink-0">
                                    {post.wikiEntryTitle}
                                  </Badge>}
                              </div>
                              <h3 className="font-semibold text-sm line-clamp-2">
                                {post.title}
                              </h3>
                              {/* Content preview removed for performance */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <ArrowBigUp className="w-3.5 h-3.5" />
                                  {post.votes}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {post.commentCount}
                                </span>
                                <span className="ml-auto">{timeAgo(post.createdAt)}</span>
                              </div>
                            </div>
                          </Link>;
                }

                // 운영자 포스트는 기존 세로형 카드
                return <Link key={post.id} to={linkTo} className="group flex flex-col bg-card rounded-lg overflow-hidden">
                          <div className="relative aspect-video lg:aspect-auto lg:h-[600px] bg-muted">
                            <SmartImage
                              src={getCardThumbnail(displayImage) || displayImage}
                              alt={post.title}
                              rootMargin="600px"
                              className={cn("w-full h-full object-cover", imageBlurred && "blur-xl")}
                              fallback={
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <FileText className="w-12 h-12" />
                                </div>
                              }
                            />
                            {imageBlurred && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                <Lock className="w-6 h-6 text-white/80" />
                                <span className="text-xs text-white/80 mt-1">{getBlurReason()}</span>
                              </div>}
                            {post.isBoosted && <Badge className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Boosted
                              </Badge>}
                            {post.wikiEntryTitle && <Badge variant="outline" className="absolute bottom-2 right-2 text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white line-clamp-1 max-w-[80%]">
                                {post.wikiEntryTitle}
                              </Badge>}
                          </div>
                          <div className="p-3 flex flex-col flex-1">
                            <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Avatar className="w-4 h-4">
                                <AvatarImage src={getAvatarThumbnail(post.authorAvatarUrl, 32) || post.authorAvatarUrl} />
                                <AvatarFallback className="text-[8px]">
                                  {(post.author || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                                {post.author || 'Unknown'}
                                {post.authorIsVerified && <Verified className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                              <span className="flex items-center gap-1">
                                <ArrowBigUp className="w-3.5 h-3.5" />
                                {post.votes}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {post.commentCount}
                              </span>
                              <span className="ml-auto">{timeAgo(post.createdAt)}</span>
                            </div>
                          </div>
                        </Link>;
              })}
                  </div>
                  {posts.length === 60 && <div className="flex justify-center mt-8">
                      <Button onClick={() => setNewPage(prev => prev + 1)} variant="outline" size="lg">
                        Load More
                      </Button>
                    </div>}
                </> : sortBy === 'wiki-trending' ?
          // Wiki Trending 탭: Wiki 페이지와 동일한 카드 포맷
          wikiTrendingEntries.length === 0 ? <div className="p-12 text-center bg-card rounded-lg">
                  <p className="text-muted-foreground">No trending entries available</p>
                </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {wikiTrendingEntries.filter(entry => {
              // 검색 필터
              if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                if (!entry.title.toLowerCase().includes(query)) {
                  return false;
                }
              }
              // 태그 필터
              if (selectedTag && tagEntryIds.length > 0) {
                return tagEntryIds.includes(entry.id);
              }
              return true;
            }).map((entry: any) => {
              const displayImage = entry.image_url || entry.metadata?.profile_image || entry.metadata?.album_cover;
              const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
              const votes = entry.votes || 0;
              const hasFanzTokenCheck = entry.fanz_tokens && entry.fanz_tokens.length > 0;
              // 1000표 미만이면 자물쇠 표시 (claimed 여부 관계없이)
              const isFullLocked = votes < 1000 && !hasFanzTokenCheck;
              const isPartialLocked = votes >= 1000 && !hasFanzTokenCheck;
              const voteProgress = Math.min(votes / 1000 * 100, 100);

              // 응원봉 가격 정보 조회
              const tokenInfo = tickerMap.get(entry.slug);
              const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
              // FanzTokenButton과 동일 로직: 공급량 0 또는 오늘 거래 없으면 0%
              const priceChange = (tokenInfo?.totalSupply === 0 || !tokenInfo?.todayFirstPrice) 
                ? 0 
                : ((tokenInfo.currentPrice - tokenInfo.todayFirstPrice) / tokenInfo.todayFirstPrice * 100);
              // extractPlainText removed for performance - content no longer fetched
              return <div key={entry.id} className="group cursor-pointer flex flex-col bg-card rounded-lg" onClick={() => navigateToEntry(entry.slug)}>
                        <div className="relative aspect-video lg:aspect-auto lg:h-[200px] rounded-t-lg overflow-hidden bg-muted">
                          <SmartImage
                            src={getCardThumbnail(displayImage) || displayImage}
                            alt={entry.title}
                            rootMargin="600px"
                            className={cn(
                              "w-full h-full object-cover",
                              isFullLocked && "brightness-[0.2]",
                              isPartialLocked && "brightness-[0.4]"
                            )}
                            fallback={
                              <div
                                className={cn(
                                  "w-full h-full flex items-center justify-center text-muted-foreground",
                                  isFullLocked && "bg-black/80",
                                  isPartialLocked && "bg-black/60"
                                )}
                              >
                                <User className="w-12 h-12" />
                              </div>
                            }
                          />
                          {/* 완전 잠김: 투표 1000개 미만 + Owner 없음 */}
                          {isFullLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                              <Lock className="w-8 h-8 text-white/80" />
                              <span className="mt-1 text-[10px] text-white/80 font-medium">Locked</span>
                              <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
                                <div className="flex items-center justify-between text-[10px] text-white/80 mb-0.5">
                                  <span>Votes</span>
                                  <span>{votes.toLocaleString()} / 1,000</span>
                                </div>
                                <Progress value={voteProgress} className="h-1.5 bg-white/20" indicatorClassName={votes < 100 ? "bg-gray-400" : votes < 500 ? "bg-blue-500" : votes < 800 ? "bg-green-500" : "bg-primary"} />
                              </div>
                            </div>}
                          {/* 부분 잠김: 투표 1000개 이상 + Owner 없음 */}
                          {isPartialLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                              <Wand2 className="w-8 h-8 animate-rainbow-glow" />
                              <span className="mt-1 text-xs text-white/80 font-medium">Lightstick Created</span>
                            </div>}
                          {entry.fanz_tokens && entry.fanz_tokens.length > 0 && <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center z-20">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>}
                          {entry.trending_score !== undefined && <Badge className="absolute top-2 left-2 text-xs px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold flex items-center gap-0.5">
                              {!hasNoMaster && <Flame className="w-3 h-3 animate-pulse" />}
                              {entry.trending_score}
                            </Badge>}
                          {entry.is_boosted && <Badge className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Boosted
                            </Badge>}
                          {entry.is_verified && <Badge className="absolute top-12 right-2 bg-blue-500 gap-1">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>}
                          <Badge variant="outline" className="absolute bottom-2 right-2 capitalize text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white">
                            {entry.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="p-3 md:p-3 flex flex-col flex-1">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base md:text-sm mb-1 line-clamp-1">
                              {entry.title}
                            </h3>
                            <button type="button" className="flex items-center gap-1.5 mb-2 cursor-pointer hover:opacity-80 text-left" onClick={e => {
                      e.stopPropagation();
                      const editor = entry.last_editor?.username ? entry.last_editor : entry.creator;
                      if (editor?.username) {
                        navigate(`/u/${editor.username}`);
                      }
                    }}>
                              <Avatar className="w-4 h-4">
                                <AvatarImage src={getAvatarThumbnail((entry.last_editor?.username ? entry.last_editor : entry.creator)?.avatar_url, 32) || (entry.last_editor?.username ? entry.last_editor : entry.creator)?.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {((entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <p className="text-sm md:text-xs text-muted-foreground flex items-center gap-0.5">
                                {(entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'Unknown'}
                                {!entry.last_editor?.username && <Crown className="w-3 h-3 text-[#ff4500]" />}
                              </p>
                            </button>
                            {/* Content preview removed for performance */}
                          </div>
                          <div className="flex items-center justify-between text-sm md:text-xs text-muted-foreground mt-auto">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                {entry.trending_score || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {entry.view_count}
                              </span>
                            </div>
                            {/* 응원봉 가격 표시 */}
                            {(hasFanzToken || tokenInfo) && <div className="flex items-center gap-1.5">
                                <Wand2 className="w-3 h-3 text-primary" />
                                <span className={cn("font-semibold", priceChange > 0 ? "text-green-500" : priceChange < 0 ? "text-red-500" : "text-foreground")}>
                                  ${tokenInfo?.currentPrice?.toFixed(2) || '0.00'}
                                </span>
                                <span className={cn("text-[10px] font-medium", priceChange > 0 ? "text-green-500" : priceChange < 0 ? "text-red-500" : "text-white/60")}>
                                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
                                </span>
                              </div>}
                          </div>
                        </div>
                      </div>;
            })}
                </div> : (() => {
            // Best 탭: 그리드 카드 형식에 순위 표시
            // 서버에서 이미 검색 필터링됨 - 정렬만 적용
            const sorted = searchQuery.trim() ? [...rankings].sort((a, b) => {
              const aTitle = a.title.toLowerCase();
              const bTitle = b.title.toLowerCase();
              const query = searchQuery.toLowerCase();

              // 정확히 일치하는 것 우선
              const aExactMatch = aTitle === query;
              const bExactMatch = bTitle === query;
              if (aExactMatch && !bExactMatch) return -1;
              if (!aExactMatch && bExactMatch) return 1;

              // 시작하는 것 우선
              const aStartsWith = aTitle.startsWith(query);
              const bStartsWith = bTitle.startsWith(query);
              if (aStartsWith && !bStartsWith) return -1;
              if (!aStartsWith && bStartsWith) return 1;

              // 포함되는 위치로 정렬
              const aIndex = aTitle.indexOf(query);
              const bIndex = bTitle.indexOf(query);
              if (aIndex !== bIndex) return aIndex - bIndex;

              // 알파벳 순으로 정렬
              return aTitle.localeCompare(bTitle);
            }) : rankings;
            // extractPlainText removed for performance - content no longer fetched
            return sorted.length === 0 ? <div className="p-12 text-center bg-card rounded-lg">
                  <p className="text-muted-foreground">
                    {searchQuery.trim() ? "No results found" : "No rankings available"}
                  </p>
                </div> : <>
                  {/* 관리자용 일괄 삭제 바 */}
                  {isAdmin && selectedEntries.size > 0 && <div className="sticky top-16 z-30 mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {selectedEntries.size} entries selected
                      </span>
                      <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete Selected
                      </Button>
                    </div>}

                  {/* Live Support - 응원봉 거래가 열린 것만 */}
                  {(() => {
                // 응원봉 거래 활성화된 엔트리들 (별도 순위 체계)
                const liveEntries = sorted.filter((e: any) => e.fanz_tokens && e.fanz_tokens.length > 0);
                return liveEntries.length > 0 && <div className="mb-6 md:mb-8 -mx-4 md:mx-0">
                      <div className="flex flex-col items-center mb-4">
                        <span className="text-xl md:text-2xl font-bold text-foreground">Live Support</span>
                        <p className="text-sm text-muted-foreground mt-1">On-chain Transparent Fan Support</p>
                      </div>
                      <Carousel opts={{
                    align: "start",
                    loop: liveEntries.length > 1
                  }} className="w-full px-4 md:px-0">
                        <CarouselContent className="-ml-3 md:-ml-4">
                          {liveEntries.map((entry: any, index: number) => {
                        const displayImage = entry.image_url;
                        // Live Support 내에서의 별도 순위
                        const rank = index + 1;
                        const isSelected = selectedEntries.has(entry.id);
                        const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                        const votes = entry.votes || 0;
                        const hasFanzTokenCheck = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                        // 1000표 미만이면 자물쇠 표시 (claimed 여부 관계없이)
                        const isFullLocked = votes < 1000 && !hasFanzTokenCheck;
                        const isPartialLocked = votes >= 1000 && !hasFanzTokenCheck;
                        const voteProgress = Math.min(votes / 1000 * 100, 100);

                        // 응원봉 가격 정보 조회
                        const tokenInfo = tickerMap.get(entry.slug);
                        const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                        return <CarouselItem key={entry.id} className="pl-3 md:pl-4 basis-auto">
                              <div className={cn("group cursor-pointer flex flex-col bg-card rounded-lg relative h-full shadow-md w-[320px] sm:w-[340px] md:w-[400px]", isSelected && "ring-2 ring-destructive")} onClick={() => navigateToEntry(entry.slug)}>
                                {/* 관리자용 체크박스 */}
                                {isAdmin && <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                                    <CreateSpecialEventDialog wikiEntryId={entry.id} wikiEntryTitle={entry.title} trigger={<Button variant="secondary" size="icon" className="h-5 w-5 bg-white/80 backdrop-blur-sm hover:bg-white" onClick={e => e.stopPropagation()}>
                                          <Sparkles className="h-2.5 w-2.5 text-primary" />
                                        </Button>} />
                                    <div onClick={e => toggleEntrySelection(entry.id, e)}>
                                      <Checkbox checked={isSelected} className="h-4 w-4 bg-white/80 backdrop-blur-sm border-2" />
                                    </div>
                                  </div>}
                                {/* 5:6 비율 */}
                                <div className="relative w-full aspect-[5/6] rounded-lg overflow-hidden bg-muted">
                                  <SmartImage
                                    src={getCarouselThumbnail(displayImage) || displayImage}
                                    alt={entry.title}
                                    eager={index < 2}
                                    rootMargin="800px"
                                    className={cn(
                                      "w-full h-full object-cover",
                                      isFullLocked && "brightness-[0.2]",
                                      isPartialLocked && "brightness-[0.4]"
                                    )}
                                    fallback={
                                      <div
                                        className={cn(
                                          "w-full h-full flex items-center justify-center text-muted-foreground",
                                          isFullLocked && "bg-black/80",
                                          isPartialLocked && "bg-black/60"
                                        )}
                                      >
                                        <User className="w-10 h-10 md:w-12 md:h-12" />
                                      </div>
                                    }
                                  />
                                  {/* 완전 잠김: 투표 1000개 미만 + Owner 없음 */}
                                  {isFullLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                      <Lock className="w-8 h-8 md:w-10 md:h-10 text-white/80" />
                                      <span className="mt-1 text-[10px] md:text-xs text-white/80 font-medium">Locked</span>
                                    </div>}
                                  {isPartialLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                      <Wand2 className="w-8 h-8 md:w-10 md:h-10 animate-rainbow-glow" />
                                      <span className="mt-1 text-[10px] md:text-xs text-white/80 font-medium">Lightstick Created</span>
                                    </div>}
                                  {/* 순위 Badge - Live Support 내 순위 */}
                                  <Badge className={cn("absolute top-1.5 left-1.5 md:top-2 md:left-2 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5", rank === 1 ? "bg-yellow-500" : rank === 2 ? "bg-gray-400" : rank === 3 ? "bg-amber-600" : "bg-primary")}>
                                    {rank <= 3 ? <Trophy className={cn("w-2.5 h-2.5 md:w-3 md:h-3", rank === 1 ? "text-yellow-200" : rank === 2 ? "text-gray-200" : "text-amber-200")} /> : <span>#</span>}
                                    {rank}
                                  </Badge>
                                  {entry.trending_score !== undefined && <Badge className={cn("absolute text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 bg-black/40 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5", isAdmin ? "top-7 md:top-8 right-1.5 md:right-2" : "top-1.5 md:top-2 right-1.5 md:right-2")}>
                                      <span className="animate-pulse">🔥</span>
                                      {Math.round(entry.trending_score)}
                                    </Badge>}
                                  {/* 하단 그라데이션 오버레이 */}
                                  <div className="absolute bottom-0 left-0 right-0 h-24 md:h-32 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                                  {/* 하단 정보 */}
                                  <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 text-white">
                                    {/* 투표 진행률 - 이름 위 */}
                                    {hasNoMaster && !hasFanzTokenCheck && <div className="mb-1.5">
                                        <div className="flex items-center justify-between text-[8px] md:text-[10px] text-white/80 mb-0.5">
                                          <span>Votes</span>
                                          <span>{votes.toLocaleString()} / 1,000</span>
                                        </div>
                                        <Progress value={voteProgress} className="h-1 md:h-1.5 bg-white/20" indicatorClassName={votes < 100 ? "bg-gray-400" : votes < 500 ? "bg-blue-500" : votes < 800 ? "bg-green-500" : "bg-primary"} />
                                      </div>}
                                    <h3 className="font-bold text-base mb-1 line-clamp-1 pl-1 md:text-lg">
                                      {entry.title}
                                    </h3>
                                    <div className="flex items-center justify-between text-sm md:text-xs text-white/80 pl-1 pb-1">
                                      <div className="flex items-center gap-2 md:gap-2">
                                        <div className="flex items-center gap-0.5">
                                          <Wand2 className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                          <span className="text-xs">{entry.fanz_token_supply || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                          <ThumbsUp className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                          <span className="text-xs">{votes}</span>
                                        </div>
                                      </div>
                                      {/* 모금 총액 표시 */}
                                      {hasFanzToken && <div className="flex items-center gap-1 pr-1">
                                          <span className="text-white/60 text-xs md:text-xs">Fund</span>
                                          <span className="font-bold text-white text-sm md:text-sm">
                                            ${Number(entry.entry_community_funds?.total_fund ?? entry.entry_community_funds?.[0]?.total_fund ?? 0).toFixed(2)}
                                          </span>
                                        </div>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              </CarouselItem>;
                      })}
                        </CarouselContent>
                        <CarouselPrevious className="hidden md:flex left-0 md:-left-4" />
                        <CarouselNext className="hidden md:flex right-0 md:-right-4" />
                      </Carousel>
                    </div>;
              })()}

                  {/* Active Votes Section - Live Support 아래 */}
                  {!isCategoryPage && <ActiveVotesSection />}

                  {/* Upcoming Listings - 자물쇠 풀린 + 마스터 없음 + Fanz Token 미발행 */}
                  {(() => {
                // Live Support 엔트리 수 계산 (순위 오프셋용)
                const liveEntriesCount = sorted.filter((e: any) => e.fanz_tokens && e.fanz_tokens.length > 0).length;
                
                const upcomingEntries = sorted.filter((entry: any) => {
                  const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                  const votes = entry.votes || 0;
                  const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                  return hasNoMaster && votes >= 1000 && !hasFanzToken;
                });
                return upcomingEntries.length > 0 && <div className="mb-6 md:mb-8 -mx-4 md:mx-0">
                        <div className="flex flex-col items-center mb-4">
                          <span className="text-xl md:text-2xl font-bold text-foreground">Upcoming Support</span>
                          <p className="text-sm text-muted-foreground mt-1">Ready to Support with LightSticks</p>
                        </div>
                        <Carousel opts={{
                    align: "start",
                    loop: upcomingEntries.length > 1
                  }} className="w-full px-4 md:px-0">
                          <CarouselContent className="-ml-3 md:-ml-4">
                            {upcomingEntries.map((entry: any, index: number) => {
                        const displayImage = entry.image_url;
                        const isSelected = selectedEntries.has(entry.id);
                        const votes = entry.votes || 0;
                        // Live Support 다음 순위로 이어지도록
                        const rank = liveEntriesCount + index + 1;
                        return <CarouselItem key={entry.id} className="pl-3 md:pl-4 basis-auto">
                                  <div className={cn("group cursor-pointer flex flex-col bg-card rounded-lg relative h-full shadow-sm w-[256px] sm:w-[272px] md:w-[320px]", isSelected && "ring-2 ring-destructive")} onClick={() => navigateToEntry(entry.slug)}>
                                    {/* 관리자용 체크박스 */}
                                    {isAdmin && <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                                        <CreateSpecialEventDialog wikiEntryId={entry.id} wikiEntryTitle={entry.title} trigger={<Button variant="secondary" size="icon" className="h-5 w-5 bg-white/80 backdrop-blur-sm hover:bg-white" onClick={e => e.stopPropagation()}>
                                              <Sparkles className="h-3 w-3 text-primary" />
                                            </Button>} />
                                        <div onClick={e => toggleEntrySelection(entry.id, e)}>
                                          <Checkbox checked={isSelected} className="h-4 w-4 bg-white/80 backdrop-blur-sm border-2" />
                                        </div>
                                      </div>}
                                    {/* 5:6 비율 */}
                                    <div className="relative w-full aspect-[5/6] rounded-lg overflow-hidden bg-muted">
                                      <SmartImage
                                        src={getCardThumbnail(displayImage) || displayImage}
                                        alt={entry.title}
                                        eager={index < 2}
                                        rootMargin="800px"
                                        className="w-full h-full object-cover brightness-50"
                                        fallback={
                                          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-black/50">
                                            <User className="w-10 h-10" />
                                          </div>
                                        }
                                      />
                                      {/* Wand 아이콘 + Be the Fandom Master */}
                                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                        <Wand2 className="w-8 h-8 text-white/80 animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                                        <span className="mt-1 text-xs text-white/80 font-medium">Opening Soon</span>
                                      </div>
                                      {/* 순위 Badge - Live Support 다음 순위 */}
                                      <Badge className="absolute top-2 left-2 text-xs px-1.5 py-0.5 bg-primary/80 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5">
                                        <span>#</span>{rank}
                                      </Badge>
                                      {/* Trending Score Badge */}
                                      {entry.trending_score !== undefined && <Badge className={cn("absolute text-xs px-1.5 py-0.5 bg-black/40 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5", isAdmin ? "top-8 right-2" : "top-2 right-2")}>
                                          <span className="animate-pulse">🔥</span>
                                          {Math.round(entry.trending_score)}
                                        </Badge>}
                                      {/* 하단 그라데이션 오버레이 */}
                                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                                      {/* 하단 정보 */}
                                      <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
                                        <h3 className="font-bold text-base sm:text-lg mb-1 line-clamp-2 pl-2">
                                          {entry.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] text-white/80 pl-2 pb-2">
                                          <div className="flex items-center gap-0.5">
                                            <ThumbsUp className="w-3 h-3" />
                                            <span>{votes}</span>
                                          </div>
                                          <div className="flex items-center gap-0.5">
                                            <Eye className="w-3 h-3" />
                                            <span>{entry.view_count || 0}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CarouselItem>;
                      })}
                          </CarouselContent>
                          <CarouselPrevious className="hidden md:flex left-0 md:-left-4" />
                          <CarouselNext className="hidden md:flex right-0 md:-right-4" />
                        </Carousel>
                      </div>;
              })()}

                  {/* 2군 캐로셀 - Live Support 및 Upcoming Support 제외한 나머지에서 1-8번째 */}
                  {(() => {
                // Live Support 엔트리 수 계산
                const liveEntriesCount = sorted.filter((e: any) => e.fanz_tokens && e.fanz_tokens.length > 0).length;
                // Upcoming Support 엔트리 수 계산
                const upcomingEntriesCount = sorted.filter((entry: any) => {
                  const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                  const votes = entry.votes || 0;
                  const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                  return hasNoMaster && votes >= 1000 && !hasFanzToken;
                }).length;
                // 상위 섹션 순위 오프셋 (Live + Upcoming)
                const rankOffset = liveEntriesCount + upcomingEntriesCount;
                
                // Live Support 엔트리 제외 + Upcoming Support 엔트리 제외
                const nonLiveEntries = sorted.filter((e: any) => {
                  const hasFanzToken = e.fanz_tokens && e.fanz_tokens.length > 0;
                  const hasNoMaster = e.page_status !== 'claimed' && e.page_status !== 'verified';
                  const votes = e.votes || 0;
                  const isUpcoming = hasNoMaster && votes >= 1000;
                  return !hasFanzToken && !isUpcoming;
                });
                const tier2Entries = nonLiveEntries.slice(0, 8);
                return tier2Entries.length > 0 && <div className="mb-6 md:mb-8 -mx-4 md:mx-0">
                        <div className="flex flex-col items-center mb-4">
                          <span className="text-xl md:text-2xl font-bold text-foreground">Next to Support</span>
                          <span className="text-xs md:text-sm text-muted-foreground mt-1">Trending Toward 1,000 Votes</span>
                        </div>
                        <Carousel opts={{
                    align: "start",
                    loop: true
                  }} className="w-full px-4 md:px-0">
                          <CarouselContent className="-ml-3 md:-ml-4">
                            {tier2Entries.map((entry: any, index: number) => {
                        const displayImage = entry.image_url;
                        // Live Support + Upcoming Support 다음 순위로 이어지도록
                        const rank = rankOffset + index + 1;
                        const isSelected = selectedEntries.has(entry.id);
                        const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                        const votes = entry.votes || 0;
                        const hasFanzTokenCheck = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                        // 1000표 미만이면 자물쇠 표시 (claimed 여부 관계없이)
                        const isFullLocked = votes < 1000 && !hasFanzTokenCheck;
                        const isPartialLocked = votes >= 1000 && !hasFanzTokenCheck;
                        const voteProgress = Math.min(votes / 1000 * 100, 100);

                        // 응원봉 가격 정보 조회
                        const tokenInfo = tickerMap.get(entry.slug);
                        const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                        // FanzTokenButton과 동일 로직: 공급량 0 또는 오늘 거래 없으면 0%
                        const priceChange = (tokenInfo?.totalSupply === 0 || !tokenInfo?.todayFirstPrice) 
                          ? 0 
                          : ((tokenInfo.currentPrice - tokenInfo.todayFirstPrice) / tokenInfo.todayFirstPrice * 100);
                        return <CarouselItem key={entry.id} className="pl-3 md:pl-4 basis-auto">
                                  <div className={cn("group cursor-pointer flex flex-col bg-card rounded-lg relative h-full shadow-sm w-[230px] sm:w-[245px] md:w-[288px]", isSelected && "ring-2 ring-destructive")} onClick={() => navigateToEntry(entry.slug)}>
                                    {/* 관리자용 체크박스 */}
                                    {isAdmin && <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                                        <CreateSpecialEventDialog wikiEntryId={entry.id} wikiEntryTitle={entry.title} trigger={<Button variant="secondary" size="icon" className="h-5 w-5 bg-white/80 backdrop-blur-sm hover:bg-white" onClick={e => e.stopPropagation()}>
                                              <Sparkles className="h-3 w-3 text-primary" />
                                            </Button>} />
                                        <div onClick={e => toggleEntrySelection(entry.id, e)}>
                                          <Checkbox checked={isSelected} className="h-4 w-4 bg-white/80 backdrop-blur-sm border-2" />
                                        </div>
                                      </div>}
                                    {/* 5:6 비율 */}
                                    <div className="relative w-full aspect-[5/6] rounded-lg overflow-hidden bg-muted">
                                      <SmartImage
                                        src={getCardThumbnail(displayImage) || displayImage}
                                        alt={entry.title}
                                        eager={index < 2}
                                        rootMargin="800px"
                                        className={cn(
                                          "w-full h-full object-cover",
                                          isFullLocked && "brightness-[0.2]",
                                          isPartialLocked && "brightness-[0.4]"
                                        )}
                                        fallback={
                                          <div
                                            className={cn(
                                              "w-full h-full flex items-center justify-center text-muted-foreground",
                                              isFullLocked && "bg-black/80",
                                              isPartialLocked && "bg-black/60"
                                            )}
                                          >
                                            <User className="w-10 h-10" />
                                          </div>
                                        }
                                      />
                                      {/* 완전 잠김: 투표 1000개 미만 + Owner 없음 */}
                                      {isFullLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                          <Lock className="w-8 h-8 text-white/80" />
                                          <span className="mt-1 text-[10px] text-white/80 font-medium">Locked</span>
                                        </div>}
                                      {/* 부분 잠김: 투표 1000개 이상 + Owner 없음 */}
                                      {isPartialLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                          <Wand2 className="w-8 h-8 animate-rainbow-glow" />
                                          <span className="mt-1 text-xs text-white/80 font-medium">Lightstick Created</span>
                                        </div>}
                                      {/* 순위 Badge */}
                                      <Badge className={cn("absolute top-2 left-2 text-xs px-1.5 py-0.5 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5", "bg-primary/80")}>
                                        <span>#</span>{rank}
                                      </Badge>
                                      {entry.trending_score !== undefined && <Badge className={cn("absolute text-xs px-1.5 py-0.5 bg-black/40 backdrop-blur-sm border-white/30 text-white font-bold flex items-center gap-0.5", isAdmin ? "top-8 right-2" : "top-2 right-2")}>
                                          <span className="animate-pulse">🔥</span>
                                          {Math.round(entry.trending_score)}
                                        </Badge>}
                                      {/* 하단 그라데이션 오버레이 */}
                                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                                      {/* 하단 정보 */}
                                      <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
                                        {/* 투표 현황 그래프 - 이름 위 */}
                                        {votes < 1000 && !hasFanzTokenCheck && <div className="mb-1.5">
                                            <div className="flex items-center justify-between text-[10px] text-white/80 mb-0.5">
                                              <span>Votes</span>
                                              <span>{votes.toLocaleString()} / 1,000</span>
                                            </div>
                                            <Progress value={voteProgress} className="h-1.5 bg-white/20" indicatorClassName={votes < 100 ? "bg-gray-400" : votes < 500 ? "bg-blue-500" : votes < 800 ? "bg-green-500" : "bg-primary"} />
                                          </div>}
                                        <h3 className="font-bold text-sm sm:text-base mb-1 line-clamp-2 pl-2">
                                          {entry.title}
                                        </h3>
                                        <div className="flex items-center justify-between text-[9px] text-white/70 pl-2 pb-2">
                                          <div className="flex items-center gap-1.5">
                                            <div className="flex items-center gap-0.5">
                                              <Wand2 className="w-2.5 h-2.5" />
                                              <span>{entry.fanz_token_supply || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                              <ThumbsUp className="w-2.5 h-2.5" />
                                              <span>{votes}</span>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                              <Users className="w-2.5 h-2.5" />
                                              <span>{entry.follower_count || 0}</span>
                                            </div>
                                          </div>
                                          {/* 응원봉 가격 표시 */}
                                          {(hasFanzToken || tokenInfo) && <div className="flex items-center gap-1 pr-2">
                                              <span className={cn("font-bold text-xs", priceChange > 0 ? "text-green-400" : priceChange < 0 ? "text-red-400" : "text-white")}>
                                                ${tokenInfo?.currentPrice?.toFixed(2) || '0.00'}
                                              </span>
                                              <span className={cn("text-[10px] font-medium", priceChange > 0 ? "text-green-400" : priceChange < 0 ? "text-red-400" : "text-white/60")}>
                                                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
                                              </span>
                                            </div>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CarouselItem>;
                      })}
                          </CarouselContent>
                          <CarouselPrevious className="hidden md:flex left-0 md:-left-4" />
                          <CarouselNext className="hidden md:flex right-0 md:-right-4" />
                        </Carousel>
                      </div>;
              })()}


                  {/* Hidden Gems 타이틀 섹션 - Live Support 및 Upcoming Support 제외한 순위 기준 */}
                  {(() => {
                // Live Support 엔트리 수 계산
                const liveEntriesCount = sorted.filter((e: any) => e.fanz_tokens && e.fanz_tokens.length > 0).length;
                // Upcoming Support 엔트리 수 계산
                const upcomingEntriesCount = sorted.filter((entry: any) => {
                  const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                  const votes = entry.votes || 0;
                  const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                  return hasNoMaster && votes >= 1000 && !hasFanzToken;
                }).length;
                // 상위 섹션 순위 오프셋 (Live + Upcoming + Next to Support 8개)
                const rankOffset = liveEntriesCount + upcomingEntriesCount + 8;
                
                // Live Support 및 Upcoming Support 제외
                const nonLiveEntries = sorted.filter((e: any) => {
                  const hasFanzToken = e.fanz_tokens && e.fanz_tokens.length > 0;
                  const hasNoMaster = e.page_status !== 'claimed' && e.page_status !== 'verified';
                  const votes = e.votes || 0;
                  const isUpcoming = hasNoMaster && votes >= 1000;
                  return !hasFanzToken && !isUpcoming;
                });
                const discoverEntries = nonLiveEntries.slice(8); // 9번째부터
                return discoverEntries.length > 0 && <>
                      <div className="mt-8 md:mt-12 mb-6 text-center">
                        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                          Discover
                        </h2>
                        <p className="text-sm md:text-base text-muted-foreground mt-1">
                          Discover and support emerging talents.
                        </p>
                      </div>

                      {/* 나머지 엔트리 그리드 (Live + Upcoming + Next to Support 다음 순위) */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-x-1.5 gap-y-3 sm:gap-4">
                        {discoverEntries.map((entry: any, index: number) => {
                      const displayImage = entry.image_url;
                      // 상위 섹션 다음 순위로 이어지도록
                      const rank = rankOffset + index + 1;
                      const isSelected = selectedEntries.has(entry.id);
                      const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                      const votes = entry.votes || 0;
                      const hasFanzTokenCheck = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                      // 1000표 미만이면 자물쇠 표시 (claimed 여부 관계없이)
                      const isFullLocked = votes < 1000 && !hasFanzTokenCheck;
                      const isPartialLocked = votes >= 1000 && !hasFanzTokenCheck;
                      const voteProgress = Math.min(votes / 1000 * 100, 100);
                      // 처음 4개는 eager 로딩, 나머지는 lazy
                      const isEager = index < 4;
                      return <div key={entry.id} className={cn("group cursor-pointer flex flex-col bg-card rounded-lg relative w-full sm:w-[230px] md:w-[288px]", isSelected && "ring-2 ring-destructive")} onClick={() => navigateToEntry(entry.slug)}>
                            {/* 관리자용 체크박스 + 이벤트 생성 버튼 */}
                            {isAdmin && <div className="absolute top-2 right-2 z-20 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <CreateSpecialEventDialog wikiEntryId={entry.id} wikiEntryTitle={entry.title} />
                                <div onClick={e => toggleEntrySelection(entry.id, e)}>
                                  <Checkbox checked={isSelected} className="h-5 w-5 bg-white/80 backdrop-blur-sm border-2" />
                                </div>
                              </div>}
                            <div className="relative aspect-[5/6] rounded-t-lg overflow-hidden bg-muted">
                              <SmartImage
                                src={getCardThumbnail(displayImage)}
                                alt={entry.title}
                                eager={isEager}
                                rootMargin="600px"
                                className={cn(
                                  "w-full h-full object-cover",
                                  isFullLocked && "brightness-[0.2]",
                                  isPartialLocked && "brightness-[0.4]"
                                )}
                                fallback={
                                  <div
                                    className={cn(
                                      "w-full h-full flex items-center justify-center text-muted-foreground",
                                      isFullLocked && "bg-black/80",
                                      isPartialLocked && "bg-black/60"
                                    )}
                                  >
                                    <User className="w-12 h-12" />
                                  </div>
                                }
                              />
                              {/* 완전 잠김: 투표 1000개 미만 + Owner 없음 */}
                              {isFullLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                  <Lock className="w-8 h-8 text-white/80" />
                                  <span className="mt-1 text-[10px] text-white/80 font-medium">Locked</span>
                                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
                                    <div className="flex items-center justify-between text-[10px] text-white/80 mb-0.5">
                                      <span>Votes</span>
                                      <span>{votes.toLocaleString()} / 1,000</span>
                                    </div>
                                    <Progress value={voteProgress} className="h-1.5 bg-white/20" indicatorClassName={votes < 100 ? "bg-gray-400" : votes < 500 ? "bg-blue-500" : votes < 800 ? "bg-green-500" : "bg-primary"} />
                                  </div>
                                </div>}
                              {/* 부분 잠김: 투표 1000개 이상 + Owner 없음 */}
                              {isPartialLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                  <Wand2 className="w-8 h-8 animate-rainbow-glow" />
                                  <span className="mt-1 text-xs text-white/80 font-medium">Lightstick Created</span>
                                </div>}
                              {/* 순위 Badge */}
                              <Badge className="absolute top-2 left-2 text-xs px-1.5 py-0.5 bg-primary backdrop-blur-sm border-white/30 text-white font-bold z-20">
                                #{rank}
                              </Badge>
                              {entry.trending_score !== undefined && <Badge className={cn("absolute text-xs px-1.5 py-0.5 bg-black/30 backdrop-blur-sm border-white/30 text-white font-semibold z-20 flex items-center gap-0.5", isAdmin ? "top-8 right-2" : "top-2 right-2")}>
                                  {!hasNoMaster && <Flame className="w-3 h-3 animate-pulse" />}
                                  {Math.round(entry.trending_score)}
                                </Badge>}
                            </div>
                          <div className="p-3 flex flex-col flex-1">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                                {entry.title}
                              </h3>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{entry.view_count || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{entry.follower_count || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>;
                    })}
                      </div>
                    </>;
              })()}
                </>;
          })()}
          </div>
        </main>

        <Footer />
      </div>

      <SignupCtaBanner buttonText="Start K-Trendz" redirectPath="/rankings" title="Discover K-Culture Rankings" subtitle="Vote & support your favorites" />
      {/* 삭제 확인 대화상자 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entries</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEntries.size} selected entries? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
};
export default Rankings;