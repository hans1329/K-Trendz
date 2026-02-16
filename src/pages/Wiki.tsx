import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import LoadingBar from "@/components/LoadingBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Verified, Eye, Users, X, ImageOff, User, TrendingUp, Clock, Star, Rss, Tag as TagIcon, ChevronDown, ChevronUp, Crown, Trash2, Wand2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Helmet } from "react-helmet-async";

const LOGO_DESKTOP_URL = "https://jguylowswwgjvotdcsfj.supabase.co/storage/v1/object/public/brand_assets/logo7.png";

const SCHEMA_TYPES = [{
  value: 'all',
  label: 'All'
}, {
  value: 'news',
  label: 'News'
}, {
  value: 'artist',
  label: 'Artists'
}, {
  value: 'member',
  label: 'Members'
}, {
  value: 'youtuber',
  label: 'YouTubers'
}, {
  value: 'actor',
  label: 'Actors'
}, {
  value: 'album',
  label: 'Albums'
}, {
  value: 'song',
  label: 'Songs'
}, {
  value: 'movie',
  label: 'Movies'
}, {
  value: 'drama',
  label: 'Dramas'
}, {
  value: 'variety_show',
  label: 'Variety Shows'
}, {
  value: 'event',
  label: 'Events'
}, {
  value: 'k_beauty',
  label: 'K-Beauty'
}, {
  value: 'beauty_brand',
  label: 'Beauty Brands'
}, {
  value: 'beauty_product',
  label: 'Beauty Products'
}, {
  value: 'restaurant',
  label: 'Restaurants'
}, {
  value: 'cafe',
  label: 'Cafes'
}, {
  value: 'k_food',
  label: 'K-Food'
}, {
  value: 'food_brand',
  label: 'Food Brands'
}, {
  value: 'food_product',
  label: 'Food Products'
}, {
  value: 'travel',
  label: 'Travel'
}];
const Wiki = () => {
  const {
    user,
    isAdmin
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const [showPopularTags, setShowPopularTags] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'recent');
  const tagsRef = useRef<HTMLDivElement>(null);
  
  // 페이지네이션 상태 (메인 검색 결과만)
  const [entriesPage, setEntriesPage] = useState(1);
  const ITEMS_PER_PAGE = 100;
  
  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setEntriesPage(1);
  }, [selectedType, searchQuery, selectedTag]);

  // HTML과 마크다운을 일반 텍스트로 변환
  const extractPlainText = (content: string) => {
    if (!content) return '';
    
    let text = content;
    
    // 블록 레벨 HTML 태그를 줄바꿈으로 교체
    text = text.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // 나머지 HTML 태그 제거
    text = text.replace(/<[^>]*>/g, '');
    
    // 마크다운 문법 제거
    text = text
      .replace(/#{1,6}\s+/g, '') // 헤더
      .replace(/\*\*(.+?)\*\*/g, '$1') // 볼드
      .replace(/\*(.+?)\*/g, '$1') // 이탤릭
      .replace(/__(.+?)__/g, '$1') // 볼드
      .replace(/_(.+?)_/g, '$1') // 이탤릭
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 링크
      .replace(/`(.+?)`/g, '$1') // 인라인 코드
      .replace(/^[-*+]\s+/gm, '') // 리스트
      .replace(/^\d+\.\s+/gm, '') // 번호 리스트
      .replace(/^\>\s+/gm, '') // 인용
      .replace(/[\r\n]+/g, ', ') // 줄바꿈을 콤마와 공백으로
      .replace(/,\s*,+/g, ',') // 연속된 콤마 제거
      .replace(/\s+/g, ' ') // 연속 공백을 하나로
      .trim();
    
    return text;
  };

  // 엔트리 삭제 함수
  const handleDeleteEntry = async (entryId: string, entryTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete "${entryTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('wiki_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: "Entry deleted successfully",
      });

      // React Query 캐시 무효화하여 목록 업데이트
      queryClient.invalidateQueries({ queryKey: ['wiki-entries'] });
      queryClient.invalidateQueries({ queryKey: ['latest-entries'] });
      queryClient.invalidateQueries({ queryKey: ['my-fanz-entries'] });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  // 엔트리의 표시 이미지 가져오기 (업로드 이미지 우선)
  const getDisplayImage = (entry: any) => {
    // 업로드 이미지 우선
    if (entry.image_url && entry.image_url.trim()) return entry.image_url;
    
    // metadata의 이미지들
    if (entry.metadata?.profile_image && entry.metadata.profile_image.trim()) {
      return entry.metadata.profile_image;
    }
    if (entry.metadata?.album_cover && entry.metadata.album_cover.trim()) {
      return entry.metadata.album_cover;
    }
    
    // content에서 이미지 URL 추출
    if (entry.content) {
      const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
      const matches = entry.content.match(urlRegex);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }
    
    return null;
  };

  // schema_type 계층 구조 매핑
  const getRelatedSchemaTypes = (type: string): string[] => {
    const hierarchyMap: Record<string, string[]> = {
      'k_food': ['k_food', 'food_brand', 'food_product', 'restaurant'],
      'k_beauty': ['k_beauty', 'beauty_brand', 'beauty_product'],
      'artist': ['artist', 'member'],
    };
    return hierarchyMap[type] || [type];
  };

  // 위키 엔트리 가져오기
  const { data: entriesData = { items: [], hasMore: false }, isLoading, isFetching } = useQuery({
    queryKey: ['wiki-entries', selectedType, searchQuery, searchQuery.toLowerCase().replace(/[^a-z0-9-]/g, ''), selectedTag, entriesPage],
    queryFn: async () => {
      let query = supabase.from('wiki_entries').select('*, last_editor:profiles!wiki_entries_last_edited_by_fkey(username, avatar_url), creator:profiles!wiki_entries_creator_id_fkey(username, avatar_url), fanz_tokens!fanz_tokens_wiki_entry_id_fkey(id)')
        .range((entriesPage - 1) * ITEMS_PER_PAGE, entriesPage * ITEMS_PER_PAGE);
      
      if (selectedType !== 'all') {
        // 선택된 타입과 하위 타입들을 모두 조회
        const relatedTypes = getRelatedSchemaTypes(selectedType);
        query = query.in('schema_type', relatedTypes as any);
      }
      if (searchQuery) {
        // 검색어 정규화 (영문/숫자/하이픈만)
        const normalizedQuery = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // slug, title, content에서 부분 문자열 검색
        query = query.or(`title.ilike.%${searchQuery.trim()}%,slug.ilike.%${normalizedQuery}%,content.ilike.%${searchQuery.trim()}%`);
      }
      
      if (selectedTag) {
        // 선택된 태그가 있으면 해당 태그를 가진 엔트리만 가져오기
        const { data: taggedEntryIds } = await supabase
          .from('wiki_entry_tags')
          .select('wiki_entry_id')
          .eq('tag_id', selectedTag);
        
        if (taggedEntryIds && taggedEntryIds.length > 0) {
          const ids = taggedEntryIds.map(t => t.wiki_entry_id);
          query = query.in('id', ids);
        } else {
          return { items: [], hasMore: false }; // 태그가 있는 엔트리가 없으면 빈 배열 반환
        }
      }
      
      // 기본 정렬: 최신순
      query = query.order('updated_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      const items = data || [];
      const hasMore = items.length === ITEMS_PER_PAGE + 1;
      
      // 검색 시 slug 매칭 우선순위로 재정렬
      if (searchQuery && items.length > 0) {
        const normalizedQuery = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        items.sort((a, b) => {
          const aSlugLower = a.slug?.toLowerCase() || '';
          const bSlugLower = b.slug?.toLowerCase() || '';
          const aTitleLower = a.title?.toLowerCase() || '';
          const bTitleLower = b.title?.toLowerCase() || '';
          
          // 1순위: slug가 검색어로 시작
          const aSlugStarts = aSlugLower.startsWith(normalizedQuery);
          const bSlugStarts = bSlugLower.startsWith(normalizedQuery);
          if (aSlugStarts && !bSlugStarts) return -1;
          if (!aSlugStarts && bSlugStarts) return 1;
          
          // 2순위: slug에 검색어 포함
          const aSlugIncludes = aSlugLower.includes(normalizedQuery);
          const bSlugIncludes = bSlugLower.includes(normalizedQuery);
          if (aSlugIncludes && !bSlugIncludes) return -1;
          if (!aSlugIncludes && bSlugIncludes) return 1;
          
          // 3순위: title에 검색어 포함
          const aTitleIncludes = aTitleLower.includes(searchQuery.toLowerCase());
          const bTitleIncludes = bTitleLower.includes(searchQuery.toLowerCase());
          if (aTitleIncludes && !bTitleIncludes) return -1;
          if (!aTitleIncludes && bTitleIncludes) return 1;
          
          // 같은 우선순위면 기존 정렬 유지
          return 0;
        });
      }
      
      return { items: items.slice(0, ITEMS_PER_PAGE), hasMore };
    },
    staleTime: 0, // 항상 최신 데이터 가져오기
    gcTime: 1 * 60 * 1000, // 1분간 캐시 유지
  });

  const entries = entriesData.items;

  // 최신 위키 엔트리 - 상위 8개만
  const { data: latestEntries = [], isLoading: isLatestLoading } = useQuery({
    queryKey: ['latest-wiki-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('*, last_editor:profiles!wiki_entries_last_edited_by_fkey(username, avatar_url), creator:profiles!wiki_entries_creator_id_fkey(username, avatar_url), fanz_tokens!fanz_tokens_wiki_entry_id_fkey(id)')
        .order('updated_at', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  // 내가 생성하거나 팔로우한 위키 엔트리 - 전체 표시
  const { data: myFanzEntries = [], isLoading: isMyFanzLoading } = useQuery({
    queryKey: ['my-fanz-entries', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // 내가 생성한 엔트리
      const { data: createdEntries, error: createdError } = await supabase
        .from('wiki_entries')
        .select('*, last_editor:profiles!wiki_entries_last_edited_by_fkey(username, avatar_url), creator:profiles!wiki_entries_creator_id_fkey(username, avatar_url), fanz_tokens!fanz_tokens_wiki_entry_id_fkey(id)')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      
      if (createdError) throw createdError;
      
      // 내가 팔로우한 엔트리 ID 가져오기
      const { data: followedData, error: followedError } = await supabase
        .from('wiki_entry_followers')
        .select('wiki_entry_id')
        .eq('user_id', user.id);
      
      if (followedError) throw followedError;
      
      // 팔로우한 엔트리 ID 목록 (내가 생성한 것 제외)
      const createdIds = new Set(createdEntries?.map(e => e.id) || []);
      const followedIds = (followedData || [])
        .map(f => f.wiki_entry_id)
        .filter(id => !createdIds.has(id));
      
      // 팔로우한 엔트리 상세 정보 가져오기
      let followedEntries: any[] = [];
      if (followedIds.length > 0) {
        const { data: followedEntriesData, error: followedEntriesError } = await supabase
          .from('wiki_entries')
          .select('*, last_editor:profiles!wiki_entries_last_edited_by_fkey(username, avatar_url), creator:profiles!wiki_entries_creator_id_fkey(username, avatar_url), fanz_tokens!fanz_tokens_wiki_entry_id_fkey(id)')
          .in('id', followedIds);
        
        if (followedEntriesError) throw followedEntriesError;
        followedEntries = followedEntriesData || [];
      }
      
      // 생성한 것 우선, 그 다음 팔로우한 것
      return [...(createdEntries || []), ...followedEntries];
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  // 검색 자동완성
  const { data: searchSuggestions = [] } = useQuery({
    queryKey: ['wiki-search-suggestions', searchQuery, searchQuery.toLowerCase().replace(/[^a-z0-9-]/g, '')],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      // 검색어 정규화 (영문/숫자/하이픈만)
      const normalizedQuery = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      // 먼저 slug 매칭만 가져오기
      const { data: slugMatches, error: slugError } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, schema_type, image_url, is_verified')
        .ilike('slug', `%${normalizedQuery}%`)
        .limit(10);
      
      if (slugError) throw slugError;
      
      // slug 매칭이 5개 미만이면 title/content 매칭도 추가
      if (slugMatches && slugMatches.length < 5) {
        const { data: otherMatches, error: otherError } = await supabase
          .from('wiki_entries')
          .select('id, title, slug, schema_type, image_url, is_verified')
          .or(`title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%`)
          .not('id', 'in', `(${slugMatches.map(m => m.id).join(',') || 'null'})`)
          .limit(5 - slugMatches.length);
        
        if (otherError) throw otherError;
        
        const allMatches = [...slugMatches, ...(otherMatches || [])];
        return allMatches;
      }
      
      // slug 매칭만 정렬해서 반환
      if (slugMatches) {
        return slugMatches.sort((a, b) => {
          const aSlugLower = a.slug?.toLowerCase() || '';
          const bSlugLower = b.slug?.toLowerCase() || '';
          
          // slug가 검색어로 시작하는 것 우선
          const aStarts = aSlugLower.startsWith(normalizedQuery);
          const bStarts = bSlugLower.startsWith(normalizedQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          
          // 같은 우선순위면 slug 길이가 짧은 것
          return aSlugLower.length - bSlugLower.length;
        }).slice(0, 5);
      }
      
      return [];
    },
    enabled: searchQuery.length >= 2
  });

  // 인기 태그 가져오기
  const { data: popularTags = [] } = useQuery({
    queryKey: ['popular-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_tags')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  // 카테고리 관련 포스트 가져오기
  const { data: categoryPosts = [], refetch: refetchCategoryPosts } = useQuery({
    queryKey: ['category-posts', selectedType, user?.id],
    queryFn: async () => {
      if (selectedType === 'all') return [];
      
      // 현재 선택된 타입의 엔트리 ID들 가져오기
      const relatedTypes = getRelatedSchemaTypes(selectedType);
      
      const { data: categoryEntries, error: entriesError } = await supabase
        .from('wiki_entries')
        .select('id')
        .in('schema_type', relatedTypes as any);
      
      if (entriesError) throw entriesError;
      
      if (!categoryEntries || categoryEntries.length === 0) return [];
      
      const entryIds = categoryEntries.map(e => e.id);
      
      // 해당 엔트리들과 연관된 포스트 가져오기
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, display_name, avatar_url), wiki_entries(title, slug)')
        .in('wiki_entry_id', entryIds)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      // 사용자의 투표 정보 가져오기
      if (user && data && data.length > 0) {
        const postIds = data.map((p: any) => p.id);
        const { data: voteData } = await supabase
          .from('post_votes')
          .select('post_id, vote_type')
          .in('post_id', postIds)
          .eq('user_id', user.id);
        
        const votesMap = new Map(voteData?.map((v: any) => [v.post_id, v.vote_type]) || []);
        
        return data.map((post: any) => ({
          ...post,
          userVote: votesMap.get(post.id) || null
        }));
      }
      
      return data || [];
    },
    enabled: selectedType !== 'all',
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  // 태그 관련 포스트 가져오기
  const { data: tagPosts = [], refetch: refetchTagPosts } = useQuery({
    queryKey: ['tag-posts', selectedTag, user?.id],
    queryFn: async () => {
      if (!selectedTag) return [];
      
      // 선택된 태그를 가진 포스트 ID 가져오기
      const { data: postTags, error: postTagsError } = await supabase
        .from('post_tags')
        .select('post_id')
        .eq('tag_id', selectedTag);
      
      if (postTagsError) throw postTagsError;
      if (!postTags || postTags.length === 0) return [];

      const postIds = postTags.map(pt => pt.post_id);

      // 포스트 정보 가져오기
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, display_name, avatar_url), wiki_entries(title, slug)')
        .in('id', postIds)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;

      // 사용자의 투표 정보 가져오기
      let userVotes: any[] = [];
      if (user && data && data.length > 0) {
        const { data: votesData } = await supabase
          .from('post_votes')
          .select('post_id, vote_type')
          .eq('user_id', user.id)
          .in('post_id', data.map(p => p.id));
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
    enabled: !!selectedTag,
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  // 카테고리 포스트 투표 핸들러
  const handleCategoryPostVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    const post = categoryPosts?.find((p: any) => p.id === postId);
    if (!post) return;
    const oldUserVote = post.userVote;
    let newUserVote: "up" | "down" | null = type;
    try {
      if (newUserVote === oldUserVote) {
        newUserVote = null;
        const { error } = await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        const { error } = await supabase.from('post_votes').insert({ post_id: postId, user_id: user.id, vote_type: newUserVote });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_votes').update({ vote_type: newUserVote }).eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      }
      await refetchCategoryPosts();
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };

  // 태그 포스트 투표 핸들러
  const handleTagPostVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive"
      });
      return;
    }
    const post = tagPosts?.find((p: any) => p.id === postId);
    if (!post) return;
    const oldUserVote = post.userVote;
    let newUserVote: "up" | "down" | null = type;
    try {
      if (newUserVote === oldUserVote) {
        // 같은 투표 클릭 시 취소
        newUserVote = null;
        const {
          error
        } = await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        // 새 투표
        const {
          error
        } = await supabase.from('post_votes').insert({
          post_id: postId,
          user_id: user.id,
          vote_type: newUserVote
        });
        if (error) throw error;
      } else {
        // 투표 변경
        const {
          error
        } = await supabase.from('post_votes').update({
          vote_type: newUserVote
        }).eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      }

      // Refetch to update UI
      await refetchTagPosts();
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (showPopularTags && tagsRef.current && popularTags && popularTags.length > 0) {
      const checkHeight = () => {
        if (tagsRef.current) {
          const firstTag = tagsRef.current.querySelector('button');
          if (firstTag) {
            const tagHeight = firstTag.offsetHeight;
            const gap = 8; // gap-2 = 0.5rem = 8px
            const threeRowsHeight = (tagHeight * 3) + (gap * 2); // 3줄 + 2개의 gap
            
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

  return (
    <>
      <Helmet>
        <title>Fanz - KTrendz | K-Pop Encyclopedia</title>
        <meta name="description" content="Browse and explore the comprehensive Fanz K-Pop wiki - Your ultimate K-Pop encyclopedia with information on artists, groups, members, albums, and more." />
        <meta name="keywords" content="Fanz, K-Pop Wiki, K-Pop Encyclopedia, K-Pop artists, K-Pop groups, K-Pop members, K-Pop information" />
        <link rel="canonical" href="https://k-trendz.com/wiki" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Fanz - K-Pop Encyclopedia" />
        <meta property="og:description" content="Browse and explore the comprehensive Fanz K-Pop wiki" />
        <meta property="og:url" content="https://k-trendz.com/wiki" />
        <meta property="og:site_name" content="KTrendz" />
        
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Fanz" />
        <meta name="twitter:description" content="Browse and explore the comprehensive Fanz K-Pop wiki" />
      </Helmet>

      <LoadingBar isLoading={isLoading || isFetching} />
      
      <V2Layout pcHeaderTitle="Fanz">
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-6`}>
          {/* Logo */}
          <div className="text-center mb-6 relative">
            <img 
              src={LOGO_DESKTOP_URL} 
              alt="KTrendz" 
              className="mx-auto h-10 md:h-14 object-contain" 
            />
            <Button 
              variant="ghost"
              size="icon"
              onClick={() => {
                const rssUrl = "https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/rss-feed?type=wiki";
                navigator.clipboard.writeText(rssUrl);
                toast({
                  title: "RSS Feed Copied",
                  description: "Fanz updates RSS feed URL copied to clipboard",
                });
              }}
              className="absolute top-0 right-0 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Subscribe to Fanz updates RSS feed"
            >
              <Rss className="w-4 h-4" />
            </Button>
          </div>

          {user && (
            <div className="mb-6 flex justify-end">
              <Button onClick={() => navigate('/wiki/create')} className="rounded-full gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Fanz</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          )}

          {/* Search */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-full md:max-w-2xl flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input 
                  placeholder="Search Fanz..."
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="pl-12 pr-12 h-10 text-sm rounded-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
                
                {/* Search Autocomplete */}
                {searchSuggestions.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-card border rounded-lg shadow-lg overflow-hidden z-50">
                    {searchSuggestions.map((suggestion) => {
                      const suggestionImage = getDisplayImage(suggestion);
                      return (
                      <button
                        key={suggestion.id}
                        onClick={() => {
                          setSearchQuery("");
                          navigate(`/k/${suggestion.slug}`);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {suggestionImage ? (
                            <img 
                              src={suggestionImage} 
                              alt={suggestion.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{suggestion.title}</span>
                            {suggestion.is_verified && (
                              <Verified className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <Badge variant="outline" className="capitalize text-xs mt-1">
                            {suggestion.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Popular Tags Toggle Button */}
              {!searchQuery && popularTags.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setShowPopularTags(prev => {
                      const next = !prev;
                      if (next) {
                        setShowAllTags(false);
                      }
                      return next;
                    });
                  }}
                  className="rounded-full h-12 w-12 flex-shrink-0"
                  title="Popular Tags"
                >
                  <TagIcon className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>


          {/* Popular Tags Cloud */}
          {!searchQuery && popularTags.length > 0 && showPopularTags && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TagIcon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Popular Tags</h3>
                {selectedTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTag(null)}
                    className="ml-auto h-6 px-2 text-xs"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
              <div 
                ref={tagsRef}
                className={`flex flex-wrap gap-2 overflow-hidden transition-all duration-300 ${
                  showAllTags ? '' : ''
                }`}
              >
                {popularTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTag(selectedTag === tag.id ? null : tag.id);
                      // 태그 선택 시 결과 영역으로 스크롤
                      if (selectedTag !== tag.id) {
                        setTimeout(() => {
                          const resultsElement = document.getElementById('tag-results');
                          if (resultsElement) {
                            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    }}
                    className={`inline-flex items-center justify-center rounded-full px-3 h-10 text-xs font-medium transition-colors ${
                      selectedTag === tag.id
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {tag.name} ({tag.usage_count})
                  </button>
                ))}
              </div>
              {needsExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="mt-2 w-full rounded-full gap-2 text-xs sm:text-sm text-muted-foreground"
                >
                  {showAllTags ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show More
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Tag Related Results */}
          {selectedTag && (
            <div id="tag-results" className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TagIcon className="w-5 h-5 text-primary" />
                <h2 className="text-xl sm:text-2xl font-bold">
                  {popularTags.find(t => t.id === selectedTag)?.name || 'Tag'} Results
                </h2>
              </div>

              {/* Tag Related Wiki Entries */}
              {entries.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3">Fanz Entries</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {entries.slice(0, 8).map(entry => {
                      const displayImage = getDisplayImage(entry);
                      return (
                      <div key={entry.id} className="group cursor-pointer flex flex-col bg-card rounded-lg" onClick={() => navigate(`/k/${entry.slug}`)}>
                        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
                          {displayImage ? (
                            <img 
                              src={displayImage} 
                              alt={entry.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  e.currentTarget.remove();
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-full h-full flex items-center justify-center text-muted-foreground';
                                  placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                  parent.insertBefore(placeholder, parent.firstChild);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User className="w-12 h-12" />
                            </div>
                          )}
                          {entry.fanz_tokens && entry.fanz_tokens.length > 0 && (
                            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-12 h-7 w-7 z-10"
                              onClick={(e) => handleDeleteEntry(entry.id, entry.title, e)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {entry.is_verified && (
                            <Badge className="absolute top-2 left-2 bg-blue-500 gap-1">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>
                          )}
                          <Badge variant="outline" className="absolute bottom-2 right-2 capitalize text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white">
                            {entry.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardContent className="p-3 flex flex-col flex-1">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                              {entry.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-0.5">
                              Edited by{' '}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const username = entry.last_editor?.username || entry.creator?.username;
                                  if (username) navigate(`/u/${username}`);
                                }}
                                className="hover:text-[#ff4500] hover:underline transition-colors"
                              >
                                {entry.last_editor?.username || entry.creator?.username || 'Unknown'}
                              </button>
                              {!entry.last_editor?.username && (
                                <Crown className="w-3 h-3 text-[#ff4500]" />
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {(() => {
                                const plainText = extractPlainText(entry.content);
                                const profilePattern = new RegExp(`^${entry.title}\\s+Profile\\s*`, 'i');
                                const cleanedContent = plainText.replace(profilePattern, '').trim();
                                return cleanedContent.substring(0, 80) + (cleanedContent.length > 80 ? '...' : '');
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {entry.follower_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {entry.view_count}
                            </span>
                          </div>
                        </CardContent>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tag Related Posts */}
              {tagPosts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Related Posts</h3>
                  <div className="space-y-4">
                    {tagPosts.map((post: any) => (
                      <div 
                        key={post.id}
                        className="bg-card rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/post/${post.id}`)}
                      >
                        <div className="p-4">
                          <div className="flex gap-4">
                            {post.image_url && (
                              <div className="w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-muted">
                                <img 
                                  src={post.image_url} 
                                  alt={post.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold mb-1 line-clamp-1">{post.title}</h3>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {(() => {
                                  try {
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(post.content || '', 'text/html');
                                    const plainText = doc.body.textContent || doc.body.innerText || '';
                                    return plainText.replace(/\s+/g, ' ').trim().substring(0, 150) + '...';
                                  } catch (e) {
                                    return '';
                                  }
                                })()}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                {post.wiki_entries && (
                                  <a
                                    href={`/k/${post.wiki_entries.slug}`}
                                    className="flex items-center gap-1 text-[#ff4500] hover:underline font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/k/${post.wiki_entries.slug}`);
                                    }}
                                  >
                                    {post.wiki_entries.title}
                                  </a>
                                )}
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {post.profiles?.display_name || post.profiles?.username || 'Unknown'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {post.votes || 0} votes
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(post.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent & My Fanz Tabs */}
          {!searchQuery && (isLatestLoading || isMyFanzLoading || latestEntries.length > 0 || myFanzEntries.length > 0) && (
            <div className="mb-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-center mb-6">
                  <TabsList className="inline-flex bg-muted/50 py-1.5 px-2 h-auto rounded-full">
                  <TabsTrigger value="recent" className="rounded-full gap-2 px-4 py-2 md:px-6 md:py-2.5">
                    <Clock className="w-4 h-4 hidden md:inline" />
                    <span className="md:hidden">New</span>
                    <span className="hidden md:inline">Recently Added</span>
                  </TabsTrigger>
                  {user && (
                    <TabsTrigger value="myfanz" className="rounded-full gap-2 px-4 py-2 md:px-6 md:py-2.5">
                      <Star className="w-4 h-4 hidden md:inline" />
                      <span className="md:hidden">My</span>
                      <span className="hidden md:inline">My Fanz</span>
                    </TabsTrigger>
                  )}
                </TabsList>
                </div>

                <TabsContent value="recent">
                  {isLatestLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                      <div className="text-center mt-4 text-sm text-muted-foreground">
                        Loading recent entries...
                      </div>
                    </div>
                  ) : latestEntries.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {latestEntries.map(entry => {
                        const displayImage = getDisplayImage(entry);
                        return (
                      <div key={entry.id} className="group cursor-pointer flex flex-col bg-card rounded-lg" onClick={() => navigate(`/k/${entry.slug}`)}>
                        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
                          {displayImage ? (
                            <img 
                              src={displayImage} 
                              alt={entry.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  e.currentTarget.remove();
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-full h-full flex items-center justify-center text-muted-foreground';
                                  placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                  parent.insertBefore(placeholder, parent.firstChild);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User className="w-12 h-12" />
                            </div>
                          )}
                          {entry.fanz_tokens && entry.fanz_tokens.length > 0 && (
                            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center z-20">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-12 h-7 w-7 z-10"
                              onClick={(e) => handleDeleteEntry(entry.id, entry.title, e)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {isAdmin && entry.trending_score !== undefined && (
                            <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
                              {entry.trending_score}
                            </Badge>
                          )}
                          {entry.is_verified && (
                            <Badge className="absolute top-12 right-2 bg-blue-500 gap-1">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>
                          )}
                          <Badge variant="outline" className="absolute bottom-2 right-2 capitalize text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white">
                            {entry.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                          <CardContent className="p-3 flex flex-col flex-1">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                                {entry.title}
                              </h3>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 mb-2 cursor-pointer hover:opacity-80 text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const editor = (entry.last_editor?.username ? entry.last_editor : entry.creator);
                                  if (editor?.username) {
                                    navigate(`/u/${editor.username}`);
                                  }
                                }}
                              >
                                <Avatar className="w-4 h-4">
                                  <AvatarImage src={(entry.last_editor?.username ? entry.last_editor : entry.creator)?.avatar_url} />
                                  <AvatarFallback className="text-[8px]">
                                    {((entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'U')[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  {(entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'Unknown'}
                                  {!entry.last_editor?.username && (
                                    <Crown className="w-3 h-3 text-[#ff4500]" />
                                  )}
                                </p>
                              </button>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {(() => {
                                  const plainText = extractPlainText(entry.content);
                                  const profilePattern = new RegExp(`^${entry.title}\\s+Profile\\s*`, 'i');
                                  const cleanedContent = plainText.replace(profilePattern, '').trim();
                                  return cleanedContent.substring(0, 80) + (cleanedContent.length > 80 ? '...' : '');
                                })()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {entry.follower_count || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {entry.view_count}
                              </span>
                            </div>
                          </CardContent>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="myfanz" className="mt-6">
                  {isMyFanzLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                      <div className="text-center mt-4 text-sm text-muted-foreground">
                        Loading your Fanz...
                      </div>
                    </div>
                  ) : myFanzEntries.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {myFanzEntries.map((entry, index) => {
                        const displayImage = getDisplayImage(entry);
                        const isCreatedByMe = entry.creator_id === user?.id;
                        return (
                      <div key={entry.id} className="group cursor-pointer flex flex-col bg-card rounded-lg" onClick={() => navigate(`/k/${entry.slug}`)}>
                        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
                          {displayImage ? (
                            <img 
                              src={displayImage} 
                              alt={entry.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  e.currentTarget.remove();
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-full h-full flex items-center justify-center text-muted-foreground';
                                  placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                  parent.insertBefore(placeholder, parent.firstChild);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User className="w-12 h-12" />
                            </div>
                          )}
                          {entry.fanz_tokens && entry.fanz_tokens.length > 0 && (
                            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center z-20">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-12 h-7 w-7 z-10"
                              onClick={(e) => handleDeleteEntry(entry.id, entry.title, e)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {isAdmin && entry.trending_score !== undefined && (
                            <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
                              {entry.trending_score}
                            </Badge>
                          )}
                          {entry.is_verified && (
                            <Badge className="absolute top-12 right-2 bg-blue-500 gap-1">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>
                          )}
                          <Badge variant="outline" className="absolute bottom-2 right-2 capitalize text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white">
                            {entry.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                          <CardContent className="p-3 flex flex-col flex-1">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                                {entry.title}
                              </h3>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 mb-2 cursor-pointer hover:opacity-80 text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const editor = (entry.last_editor?.username ? entry.last_editor : entry.creator);
                                  if (editor?.username) {
                                    navigate(`/u/${editor.username}`);
                                  }
                                }}
                              >
                                <Avatar className="w-4 h-4">
                                  <AvatarImage src={(entry.last_editor?.username ? entry.last_editor : entry.creator)?.avatar_url} />
                                  <AvatarFallback className="text-[8px]">
                                    {((entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'U')[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  {(entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'Unknown'}
                                  {!entry.last_editor?.username && (
                                    <Crown className="w-3 h-3 text-[#ff4500]" />
                                  )}
                                </p>
                              </button>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {(() => {
                                  const plainText = extractPlainText(entry.content);
                                  const profilePattern = new RegExp(`^${entry.title}\\s+Profile\\s*`, 'i');
                                  const cleanedContent = plainText.replace(profilePattern, '').trim();
                                  return cleanedContent.substring(0, 80) + (cleanedContent.length > 80 ? '...' : '');
                                })()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {entry.follower_count || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {entry.view_count}
                              </span>
                            </div>
                          </CardContent>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">
                        You haven't created or followed any Fanz yet
                      </p>
                      <Button onClick={() => navigate('/wiki/create')}>
                        Create Your First Fanz
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}


          {/* Tabs */}
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            {/* Mobile: Dropdown */}
            <div className="md:hidden mb-6">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full rounded-full bg-[#ff4500] text-white border-none hover:bg-[#ff4500]/90">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  {SCHEMA_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Tab Buttons */}
            <TabsList className="hidden md:flex mb-6 flex-wrap h-auto gap-x-2 gap-y-3 w-full justify-start bg-primary p-2 rounded-lg">
              {SCHEMA_TYPES.map(type => <TabsTrigger key={type.value} value={type.value} className="rounded-full data-[state=active]:bg-white data-[state=active]:text-primary hover:bg-white/20 text-white border-b border-white/10">
                  {type.label}
                </TabsTrigger>)}
            </TabsList>

            <TabsContent value={selectedType} id="wiki-results">
              {isLoading ? <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    Loading...
                  </div>
                </div> : entries.length === 0 ? <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No entries found' : 'No entries yet'}
                  </p>
                  {user && !searchQuery && <Button onClick={() => navigate('/wiki/create')}>
                      Create First Entry
                    </Button>}
                </div> : <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {entries.map(entry => {
                      const displayImage = getDisplayImage(entry);
                      return (
                      <div key={entry.id} className="group cursor-pointer flex flex-col bg-card rounded-lg" onClick={() => navigate(`/k/${entry.slug}`)}>
                        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
                          {displayImage ? (
                            <img 
                              src={displayImage} 
                              alt={entry.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  e.currentTarget.remove();
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-full h-full flex items-center justify-center text-muted-foreground';
                                  placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                  parent.insertBefore(placeholder, parent.firstChild);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User className="w-12 h-12" />
                            </div>
                          )}
                          {entry.fanz_tokens && entry.fanz_tokens.length > 0 && (
                            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center z-20">
                              <Wand2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-12 h-7 w-7 z-10"
                              onClick={(e) => handleDeleteEntry(entry.id, entry.title, e)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {isAdmin && entry.trending_score !== undefined && (
                            <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
                              {entry.trending_score}
                            </Badge>
                          )}
                          {entry.is_verified && <Badge className="absolute top-12 right-2 bg-blue-500 gap-1">
                              <Verified className="w-3 h-3" />
                              Verified
                            </Badge>}
                          <Badge variant="outline" className="absolute bottom-2 right-2 capitalize text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white">
                            {entry.schema_type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardContent className="p-3 flex flex-col flex-1">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                              {entry.title}
                            </h3>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 mb-2 cursor-pointer hover:opacity-80 text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                const editor = (entry.last_editor?.username ? entry.last_editor : entry.creator);
                                if (editor?.username) {
                                  navigate(`/u/${editor.username}`);
                                }
                              }}
                            >
                              <Avatar className="w-4 h-4">
                                <AvatarImage src={(entry.last_editor?.username ? entry.last_editor : entry.creator)?.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {((entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                                {(entry.last_editor?.username ? entry.last_editor : entry.creator)?.username || 'Unknown'}
                                {!entry.last_editor?.username && (
                                  <Crown className="w-3 h-3 text-[#ff4500]" />
                                )}
                              </p>
                            </button>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {(() => {
                                const plainText = extractPlainText(entry.content);
                                const profilePattern = new RegExp(`^${entry.title}\\s+Profile\\s*`, 'i');
                                const cleanedContent = plainText.replace(profilePattern, '').trim();
                                return cleanedContent.substring(0, 80) + (cleanedContent.length > 80 ? '...' : '');
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {entry.follower_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {entry.view_count}
                            </span>
                          </div>
                        </CardContent>
                      </div>
                      );
                    })}
                  </div>
                  
                  {/* Load More Button */}
                  {entriesData.hasMore && (
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={() => setEntriesPage(prev => prev + 1)}
                        variant="outline"
                        className="rounded-full"
                      >
                        Load More
                      </Button>
                    </div>
                  )}

                  {/* Category Related Posts */}
                  {categoryPosts.length > 0 && selectedType !== 'all' && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TagIcon className="w-5 h-5" />
                        Related Posts in {SCHEMA_TYPES.find(t => t.value === selectedType)?.label}
                      </h3>
                      <div className="space-y-4">
                        {categoryPosts.map((post: any) => (
                          <div 
                            key={post.id}
                            className="bg-card rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/post/${post.id}`)}
                          >
                            <div className="p-4">
                              <div className="flex gap-4">
                                {post.image_url && (
                                  <div className="w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-muted">
                                    <img 
                                      src={post.image_url} 
                                      alt={post.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold mb-1 line-clamp-1">{post.title}</h3>
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {(() => {
                                      try {
                                        const parser = new DOMParser();
                                        const doc = parser.parseFromString(post.content || '', 'text/html');
                                        const plainText = doc.body.textContent || doc.body.innerText || '';
                                        return plainText.replace(/\s+/g, ' ').trim().substring(0, 150) + '...';
                                      } catch (e) {
                                        return '';
                                      }
                                    })()}
                                  </p>
                                   <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                    {post.wiki_entries && (
                                      <a
                                        href={`/k/${post.wiki_entries.slug}`}
                                        className="flex items-center gap-1 text-[#ff4500] hover:underline font-medium"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/k/${post.wiki_entries.slug}`);
                                        }}
                                      >
                                        {post.wiki_entries.title}
                                      </a>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Avatar className="w-4 h-4">
                                        <AvatarImage src={post.profiles?.avatar_url} />
                                        <AvatarFallback className="text-[8px]">
                                          {(post.profiles?.username || 'U')[0].toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      {post.profiles?.display_name || post.profiles?.username || 'Unknown'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" />
                                      {post.votes || 0} votes
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(post.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </>}
            </TabsContent>
          </Tabs>
        </div>
      </V2Layout>
    </>
  );
};
export default Wiki;