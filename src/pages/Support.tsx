import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Search, Lock, Wand2, ThumbsUp, Eye, Users, User, Flame, Grid2X2, List, LayoutList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHotTokensData } from "@/hooks/useHotTokensData";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCardThumbnail } from "@/lib/image";
import SmartImage from "@/components/SmartImage";
import V2Layout from "@/components/home/V2Layout";

type LayoutMode = 'grid-1' | 'grid-2' | 'list';

const PAGE_SIZE = 50;

// 엔트리 타입 정의
interface WikiEntry {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  metadata: any;
  schema_type: string;
  trending_score: number | null;
  votes: number;
  view_count: number;
  follower_count: number;
  page_status: string | null;
  fanz_tokens?: { total_supply: number; base_price: number; k_value: number }[] | null;
  entry_community_funds?: { total_fund: number } | null;
}

const Support = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid-1');

  // PC에서는 기본 2컬럼
  useEffect(() => {
    if (!isMobile) setLayoutMode('grid-2');
  }, []);
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 온체인 가격 데이터 (공통 훅)
  const { data: hotTokens = [] } = useHotTokensData({ limit: 60 });
  const priceMap = new Map(hotTokens.map(t => [t.id, t.current_price]));

  // 무한 스크롤 페이지네이션 쿼리
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['support-entries'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('wiki_entries')
        .select(`
          id, title, slug, image_url, metadata, schema_type, trending_score,
          votes, view_count, follower_count, page_status,
          fanz_tokens(total_supply, base_price, k_value),
          entry_community_funds(total_fund)
        `)
        .in('schema_type', ['artist', 'member'])
        .order('trending_score', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw error;
      return (data || []) as WikiEntry[];
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return (lastPageParam ?? 0) + 1;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 전체 엔트리 플랫화
  const entries = data?.pages.flat() || [];

  // IntersectionObserver로 무한 스크롤 감지
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 검색 필터링
  const filteredEntries = entries.filter(entry => 
    entry.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 엔트리 클릭 핸들러
  const navigateToEntry = (slug: string) => {
    navigate(`/k/${slug}`);
  };

  return (
    <>
      <Helmet>
        <title>Support Artists - KTRENDZ</title>
        <meta name="description" content="Support your favorite K-Pop artists and members" />
      </Helmet>
      
      <V2Layout pcHeaderTitle="Support" showBackButton>
        <main className="min-h-screen bg-background pb-20 pt-2">
          {/* 검색 헤더 */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/50 border-0 rounded-full text-sm"
                />
              </div>
              {/* 레이아웃 전환 버튼 */}
              <div className="flex items-center bg-muted/50 rounded-full p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-full hover:bg-transparent",
                    layoutMode === 'grid-1' && "bg-primary text-white hover:bg-primary hover:text-white"
                  )}
                  onClick={() => setLayoutMode('grid-1')}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-full hover:bg-transparent",
                    layoutMode === 'grid-2' && "bg-primary text-white hover:bg-primary hover:text-white"
                  )}
                  onClick={() => setLayoutMode('grid-2')}
                >
                  <Grid2X2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-full hover:bg-transparent",
                    layoutMode === 'list' && "bg-primary text-white hover:bg-primary hover:text-white"
                  )}
                  onClick={() => setLayoutMode('list')}
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="px-3 py-3">
            {/* 섹션 타이틀 */}
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Artists & Members
              </h2>
              <span className="text-xs text-muted-foreground">
                ({filteredEntries.length}{hasNextPage ? '+' : ''})
              </span>
            </div>

            {isLoading ? (
              <div className={cn(
                layoutMode === 'list' 
                  ? "flex flex-col gap-2" 
                  : layoutMode === 'grid-1'
                    ? "grid grid-cols-1 gap-2"
                    : "grid grid-cols-2 gap-2"
              )}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  layoutMode === 'list' ? (
                    <div key={i} className="flex gap-3 bg-card rounded-lg p-2.5">
                      <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="w-full">
                      <Skeleton className="aspect-[4/5] rounded-t-lg" />
                      <Skeleton className="h-14 rounded-b-lg" />
                    </div>
                  )
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-lg">
                <p className="text-muted-foreground text-sm">
                  {searchQuery.trim() ? "No results found" : "No artists available"}
                </p>
              </div>
            ) : (
              <div className={cn(
                layoutMode === 'list' 
                  ? "flex flex-col gap-2" 
                  : layoutMode === 'grid-1'
                    ? "grid grid-cols-1 gap-2"
                    : "grid grid-cols-2 gap-2"
              )}>
                {filteredEntries.map((entry, index) => {
                  const displayImage = entry.image_url;
                  const rank = index + 1;
                  const hasNoMaster = entry.page_status !== 'claimed' && entry.page_status !== 'verified';
                  const votes = entry.votes || 0;
                  const hasFanzToken = entry.fanz_tokens && entry.fanz_tokens.length > 0;
                  const isFullLocked = votes < 1000 && !hasFanzToken;
                  const isPartialLocked = votes >= 1000 && !hasFanzToken;
                      const voteProgress = Math.min(votes / 1000 * 100, 100);
                      const isEager = index < 4;
                      const totalFund = entry.entry_community_funds?.total_fund || 0;
                      const fundDisplay = totalFund >= 1000 
                        ? `$${(totalFund / 1000).toFixed(1)}K` 
                        : `$${totalFund.toFixed(2)}`;

                  // 리스트 모드 렌더링
                  if (layoutMode === 'list') {
                    return (
                      <div
                        key={entry.id}
                        className="group cursor-pointer flex gap-3 bg-card rounded-xl p-2.5 relative active:scale-[0.98] transition-transform"
                        onClick={() => navigateToEntry(entry.slug)}
                      >
                        {/* 썸네일 */}
                        <div className="relative w-[88px] h-[88px] rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <User className="w-8 h-8" />
                              </div>
                            }
                          />
                          <div className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1 py-0.5 rounded">
                            #{rank}
                          </div>
                          {isFullLocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-white/80" />
                            </div>
                          )}
                          {isPartialLocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Wand2 className="w-6 h-6 animate-rainbow-glow" />
                            </div>
                          )}
                        </div>
                        {/* 정보 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="font-semibold text-sm truncate">{entry.title}</h3>
                            {hasFanzToken && (
                              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Wand2 className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-0.5">
                              <ThumbsUp className="w-3 h-3" />
                              <span>{votes.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Eye className="w-3 h-3" />
                              <span>{(entry.view_count || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Users className="w-3 h-3" />
                              <span>{entry.follower_count || 0}</span>
                            </div>
                            {entry.trending_score !== undefined && entry.trending_score !== null && (
                              <div className="flex items-center gap-0.5 text-primary">
                                <Flame className="w-3 h-3" />
                                <span>{Math.round(entry.trending_score)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {totalFund > 0 && (
                              <div className="bg-green-500/10 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                                <span className="text-[10px] text-green-600 font-medium">Fund {fundDisplay}</span>
                              </div>
                            )}
                            {hasFanzToken && (() => {
                              const price = priceMap.get(entry.id);
                              if (!price) return null;
                              const display = price >= 1000 ? `$${(price / 1000).toFixed(1)}K` : `$${price.toFixed(2)}`;
                              return (
                                <div className="bg-primary/10 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                                  <Wand2 className="w-2.5 h-2.5 text-primary" />
                                  <span className="text-[10px] text-primary font-medium">{display}</span>
                                </div>
                              );
                            })()}
                          </div>
                          {isFullLocked && (
                            <div className="mt-1.5">
                              <Progress
                                value={voteProgress}
                                className="h-1 bg-muted"
                                indicatorClassName={
                                  votes < 100 ? "bg-gray-400" :
                                  votes < 500 ? "bg-blue-500" :
                                  votes < 800 ? "bg-green-500" : "bg-primary"
                                }
                              />
                              <p className="text-[9px] text-muted-foreground mt-0.5">{votes.toLocaleString()} / 1,000 votes to unlock</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 그리드 모드 렌더링
                  return (
                    <div
                      key={entry.id}
                      className="group cursor-pointer flex flex-col bg-card rounded-xl relative w-full active:scale-[0.98] transition-transform overflow-hidden"
                      onClick={() => navigateToEntry(entry.slug)}
                    >
                      <div className={cn(
                        "relative overflow-hidden bg-muted",
                        layoutMode === 'grid-1' ? "aspect-[16/9]" : "aspect-[4/5]"
                      )}>
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
                              <User className="w-10 h-10" />
                            </div>
                          }
                        />
                        {isFullLocked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                            <Lock className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.8)' }} />
                            <span className="mt-1 text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Locked</span>
                            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                              <div className="flex items-center justify-between text-[8px] mb-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                <span>Votes</span>
                                <span>{votes.toLocaleString()} / 1K</span>
                              </div>
                              <Progress
                                value={voteProgress}
                                className="h-1 bg-white/20"
                                indicatorClassName={
                                  votes < 100 ? "bg-gray-400" :
                                  votes < 500 ? "bg-blue-500" :
                                  votes < 800 ? "bg-green-500" : "bg-primary"
                                }
                              />
                            </div>
                          </div>
                        )}
                        {isPartialLocked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                            <Wand2 className="w-7 h-7 animate-rainbow-glow" />
                            <span className="mt-1 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Lightstick</span>
                          </div>
                        )}
                        <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-20">
                          #{rank}
                        </div>
                        {entry.trending_score !== undefined && entry.trending_score !== null && (
                          <div className="absolute top-1.5 right-1.5 bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded z-20 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />
                            {Math.round(entry.trending_score)}
                          </div>
                        )}
                        {hasFanzToken && (
                          <div className="absolute top-8 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-20">
                            <Wand2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {layoutMode === 'grid-2' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 z-20">
                            <div className="flex items-center gap-2 text-[10px] text-white/90">
                              <div className="flex items-center gap-0.5">
                                <ThumbsUp className="w-2.5 h-2.5" />
                                <span>{votes.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Eye className="w-2.5 h-2.5" />
                                <span>{(entry.view_count || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" />
                                <span>{entry.follower_count || 0}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-2.5 flex flex-col flex-1">
                        <h3 className="font-semibold text-sm line-clamp-1">
                          {entry.title}
                        </h3>
                        {layoutMode !== 'grid-2' && (
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            <div className="flex items-center gap-0.5">
                              <ThumbsUp className="w-3 h-3" />
                              <span>{votes.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Eye className="w-3 h-3" />
                              <span>{(entry.view_count || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Users className="w-3 h-3" />
                              <span>{entry.follower_count || 0}</span>
                            </div>
                          </div>
                        )}
                        {/* 펀드 & 응원봉 가격 행 (발행대기도 표시) */}
                        <div className="mt-2 pt-3 pb-1 border-t border-border/50">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Fund</span>
                            <span>Lightstick</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-green-600 font-bold text-sm">
                              {totalFund > 0 ? fundDisplay : "—"}
                            </span>
                            <span className="text-primary font-bold text-sm">
                              {(() => {
                                if (!hasFanzToken) return "—";
                                const price = priceMap.get(entry.id);
                                if (!price) return "—";
                                return price >= 1000
                                  ? `$${(price / 1000).toFixed(1)}K`
                                  : `$${price.toFixed(2)}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 무한 스크롤 트리거 & 로딩 인디케이터 */}
            <div ref={loadMoreRef} className="py-6 flex justify-center">
              {isFetchingNextPage && (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </main>
      </V2Layout>
    </>
  );
};

export default Support;
