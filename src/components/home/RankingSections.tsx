import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Activity, Flame, ChevronRight, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import SmartImage from "@/components/SmartImage";
import { cn } from "@/lib/utils";
import { calculateStripeTotal, fetchTokenPriceData } from "@/hooks/useFanzTokenPrice";
import { useHotTokensData } from "@/hooks/useHotTokensData";

// Fund 금액 포맷 - 항상 소수 둘째자리까지 표시
const formatFund = (amount: number) => {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
};

// 가격 포맷
const formatPrice = (price: number) => {
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
};

// 변동률 포맷
const formatChange = (change: number) => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

// Trending Now 캐러셀 카드 컴포넌트 (더 큰 버전)
const TrendingCard = ({ 
  rank, 
  entry 
}: { 
  rank: number; 
  entry: any;
}) => (
  <Link
    to={`/k/${entry.slug}`}
    className="flex-shrink-0 w-[180px] md:w-[220px] active:scale-95 transition-transform duration-150"
  >
    <Card className="overflow-hidden bg-card border-0 shadow-card rounded-2xl">
      {/* 이미지 */}
      <div className="relative w-full h-[140px] md:h-[180px] bg-muted">
        <SmartImage
          src={entry.image_url || (entry.metadata as any)?.profile_image}
          alt={entry.title}
          className="w-full h-full object-cover"
        />
        {/* 랭킹 뱃지 */}
        <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
          {rank}
        </div>
        {/* HOT 뱃지 - 상위 3개만 */}
        {rank <= 3 && (
          <Badge className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 h-5 rounded-none rounded-bl-lg rounded-tr-2xl font-semibold">
            🔥 HOT
          </Badge>
        )}
        {/* Fund 뱃지 - 우하단 */}
        {entry.community_fund > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2 py-1 text-[10px]">
            <span className="font-semibold">
              <span className="text-white/60">Fund</span>{" "}
              <span className="text-white">{formatFund(entry.community_fund)}</span>
            </span>
          </div>
        )}
      </div>
      
      {/* 정보 */}
      <div className="p-3">
        <p className="text-sm font-semibold text-foreground truncate">
          {entry.title}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-bold text-foreground">
            {formatPrice(entry.current_price)}
          </span>
          <span className={`text-xs font-semibold ${
            (entry.price_change ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {formatChange(entry.price_change ?? 0)}
          </span>
        </div>
      </div>
    </Card>
  </Link>
);

// 공통 랭킹 아이템 컴포넌트 (리스트용)
const RankingItem = ({ 
  rank, 
  title, 
  slug, 
  imageUrl, 
  price, 
  change,
  subtitle,
}: {
  rank: number;
  title: string;
  slug: string;
  imageUrl?: string | null;
  price?: number;
  change?: number;
  subtitle?: string;
}) => (
  <Link
    to={`/k/${slug}`}
    className="flex items-center gap-3 py-2.5 active:bg-muted/50 rounded-lg transition-colors"
  >
    {/* 순위 */}
    <span className="w-6 text-center text-sm font-bold text-muted-foreground">
      {rank}
    </span>
    
    {/* 아바타 */}
    <Avatar className="w-11 h-11 shrink-0">
      <AvatarImage src={imageUrl || undefined} />
      <AvatarFallback className="bg-muted text-sm font-medium">
        {title?.[0]}
      </AvatarFallback>
    </Avatar>
    
    {/* 이름 및 서브타이틀 */}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      )}
    </div>
    
    {/* 가격/변동률 */}
    <div className="text-right shrink-0">
      {price !== undefined && (
        <p className="text-sm font-bold text-foreground">{formatPrice(price)}</p>
      )}
      {change !== undefined && (
        <p className={`text-xs font-semibold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatChange(change)}
        </p>
      )}
    </div>
  </Link>
);

// 섹션 헤더 컴포넌트
const SectionHeader = ({ 
  icon: Icon, 
  title, 
  iconColor = "text-primary",
  linkTo = "/rankings"
}: {
  icon: any;
  title: string;
  iconColor?: string;
  linkTo?: string;
}) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h3 className="text-base font-bold text-foreground">{title}</h3>
    </div>
    <Link 
      to={linkTo} 
      className="text-xs text-muted-foreground flex items-center active:text-primary"
    >
      More <ChevronRight className="w-4 h-4" />
    </Link>
  </div>
);

// 로딩 스켈레톤
const RankingSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-2.5 py-2">
        <Skeleton className="w-5 h-4" />
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1">
          <Skeleton className="w-20 h-3 mb-1" />
          <Skeleton className="w-14 h-2" />
        </div>
        <Skeleton className="w-12 h-4" />
      </div>
    ))}
  </div>
);

// Trending 캐러셀 스켈레톤
const TrendingCarouselSkeleton = () => (
  <div className="flex gap-3 px-4 pb-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex-shrink-0 w-[180px] md:w-[220px]">
        <Skeleton className="w-full h-[140px] md:h-[180px] rounded-t-2xl" />
        <Skeleton className="w-full h-[68px] rounded-b-2xl" />
      </div>
    ))}
  </div>
);
const RankingSections = () => {
  const [activeTab, setActiveTab] = useState<'gainers' | 'traded'>('gainers');
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Trending Now - Rankings 티커와 동일한 24시간 가격 변동 로직 사용
  const { data: hotTokensData = [], isLoading: trendingLoading } = useHotTokensData(5);

  // 스크롤 상태 업데이트
  const updateScrollState = useCallback(() => {
    const el = trendingScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trendingScrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState, hotTokensData]);

  const scrollTrending = (direction: "left" | "right") => {
    const el = trendingScrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -240 : 240;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };
  
  // TrendingCard에 맞는 형태로 변환
  const trendingData = hotTokensData.map(token => ({
    id: token.id,
    title: token.title,
    slug: token.slug,
    image_url: token.image_url,
    metadata: token.metadata,
    current_price: token.current_price,
    price_change: token.price_change,
    community_fund: token.community_fund,
  }));

  // Most Traded (total_supply 기준 - 거래량 대용) - 온체인 가격 조회
  const { data: tradedData = [], isLoading: tradedLoading } = useQuery({
    queryKey: ['ranking-traded-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select(`
          id, token_id, total_supply, base_price, k_value,
          wiki_entries:wiki_entry_id (id, title, slug, image_url, metadata)
        `)
        .eq('is_active', true)
        .order('total_supply', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      if (!data) return [];
      
      // 온체인 가격 병렬 조회
      const tokensWithPrices = await Promise.all(
        data.map(async (token) => {
          try {
            const priceData = await fetchTokenPriceData(token.token_id);
            
            if (priceData?.isOnchainData && priceData?.buyCost) {
              const priceWithStripe = calculateStripeTotal(priceData.buyCost);
              return {
                ...token,
                wiki_entry: token.wiki_entries,
                current_price: priceWithStripe,
                total_supply: priceData.totalSupply ?? token.total_supply,
              };
            }
          } catch (e) {
            console.warn('Failed to fetch onchain price for', token.id);
          }
          
          // 폴백: DB 데이터로 계산
          const kValueScaled = token.k_value / 1e12;
          const bondingPrice = token.base_price + (kValueScaled * Math.sqrt(token.total_supply));
          return {
            ...token,
            wiki_entry: token.wiki_entries,
            current_price: calculateStripeTotal(bondingPrice),
          };
        })
      );
      
      return tokensWithPrices;
    },
    staleTime: 30 * 1000, // 30초 캐싱
  });

  // Top Gainers - 공통 훅 데이터 사용, price_change 기준 정렬
  const gainersData = [...hotTokensData].sort((a, b) => b.price_change - a.price_change);
  const gainersLoading = trendingLoading;

  return (
    <section className="py-4">
      {/* Trending Now - 캐러셀 */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-4 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-bold text-foreground">Trending Now</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* PC 전용 좌우 화살표 */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7 rounded-full"
                disabled={!canScrollLeft}
                onClick={() => scrollTrending("left")}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7 rounded-full"
                disabled={!canScrollRight}
                onClick={() => scrollTrending("right")}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Link 
              to="/trending" 
              className="text-xs text-muted-foreground flex items-center active:text-primary"
            >
              More <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        
        {trendingLoading ? (
          <TrendingCarouselSkeleton />
        ) : (
          <div className="relative overflow-hidden">
            <div
              ref={trendingScrollRef}
              className="flex gap-3 px-4 pb-3 overflow-x-auto scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {trendingData.map((entry, idx) => (
                <TrendingCard key={entry.id} rank={idx + 1} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gainers & Traded - 탭 UI */}
      <div className="px-4">
        <Card className="p-4 bg-card border-0 shadow-card rounded-2xl">
          {/* 탭 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-muted rounded-full p-1">
              <button
                onClick={() => setActiveTab('gainers')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'gainers' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground"
                )}
              >
                <TrendingUp className="w-4 h-4 text-green-500" />
                Gainers
              </button>
              <button
                onClick={() => setActiveTab('traded')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'traded' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground"
                )}
              >
                <Activity className="w-4 h-4 text-blue-500" />
                Traded
              </button>
            </div>
            <Link 
              to={`/trending?tab=${activeTab}`}
              className="text-xs text-muted-foreground flex items-center active:text-primary"
            >
              More <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {/* 탭 콘텐츠 */}
          {activeTab === 'gainers' ? (
            gainersLoading ? (
              <RankingSkeleton />
            ) : (
              <div className="space-y-1">
                {gainersData.slice(0, 5).map((entry, idx) => (
                  <RankingItem
                    key={entry.id}
                    rank={idx + 1}
                    title={entry.title}
                    slug={entry.slug}
                    imageUrl={entry.image_url || (entry.metadata as any)?.profile_image}
                    price={entry.current_price}
                    change={entry.price_change}
                  />
                ))}
              </div>
            )
          ) : (
            tradedLoading ? (
              <RankingSkeleton />
            ) : (
              <div className="space-y-1">
                {tradedData.slice(0, 5).map((token, idx) => (
                  <RankingItem
                    key={token.id}
                    rank={idx + 1}
                    title={token.wiki_entry?.title || 'Unknown'}
                    slug={token.wiki_entry?.slug || token.id}
                    imageUrl={token.wiki_entry?.image_url || (token.wiki_entry?.metadata as any)?.profile_image}
                    price={token.current_price}
                    subtitle={`${token.total_supply} tokens`}
                  />
                ))}
              </div>
            )
          )}
        </Card>
      </div>
    </section>
  );
};

export default RankingSections;
