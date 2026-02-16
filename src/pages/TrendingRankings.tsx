import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Flame, TrendingUp, Activity, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartImage from "@/components/SmartImage";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHotTokensData } from "@/hooks/useHotTokensData";
import BotTradingActivity from "@/components/home/BotTradingActivity";

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

const TrendingRankings = () => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'trending' | 'gainers' | 'traded') || 'trending';
  const [activeTab, setActiveTab] = useState<'trending' | 'gainers' | 'traded'>(initialTab);

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    const tabParam = searchParams.get('tab') as 'trending' | 'gainers' | 'traded';
    if (tabParam && ['trending', 'gainers', 'traded'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // 공통 훅을 사용해 데이터 조회 (온체인 가격 + 24h 변동률 포함)
  const { data: trendingData = [], isLoading: trendingLoading } = useHotTokensData({ limit: 50, sortBy: 'trending' });
  
  // Gainers: 가격 상승률 기준 정렬
  const gainersData = useMemo(() => {
    return [...trendingData].sort((a, b) => b.price_change - a.price_change);
  }, [trendingData]);
  
  // Traded: 거래량(total_supply) 기준 정렬
  const tradedData = useMemo(() => {
    return [...trendingData].sort((a, b) => b.total_supply - a.total_supply);
  }, [trendingData]);

  const currentData = activeTab === 'trending' ? trendingData : activeTab === 'gainers' ? gainersData : tradedData;
  const isLoading = trendingLoading;

  // 탭 컴포넌트
  const TabsComponent = (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
      <TabsList className={`${isMobile ? 'w-full' : 'w-auto'} grid grid-cols-3 h-10 bg-muted/50`}>
        <TabsTrigger value="trending" className="text-sm gap-1.5">
          <Flame className="w-4 h-4" />
          Trending
        </TabsTrigger>
        <TabsTrigger value="gainers" className="text-sm gap-1.5">
          <TrendingUp className="w-4 h-4" />
          Gainers
        </TabsTrigger>
        <TabsTrigger value="traded" className="text-sm gap-1.5">
          <Activity className="w-4 h-4" />
          Traded
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  // 리스트 아이템 렌더러
  const renderItem = (item: any, idx: number) => (
    <Link
      key={item.id}
      to={`/k/${item.slug}`}
      className="block active:scale-[0.98] transition-transform duration-150"
    >
      <Card className="flex items-center gap-3 p-3 bg-card border-0 shadow-sm rounded-2xl hover:bg-muted/50 transition-colors">
        {/* 순위 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          idx < 3 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {idx + 1}
        </div>
        
        {/* 이미지 */}
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
          <SmartImage
            src={item.image_url || item.metadata?.profile_image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          {idx < 3 && (
            <Badge className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[8px] px-1 py-0 h-4 rounded-bl-md rounded-tr-xl font-semibold">
              🔥
            </Badge>
          )}
        </div>
        
        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold text-foreground">
              {formatPrice(item.current_price || 0)}
            </span>
            {activeTab !== 'traded' && item.price_change !== undefined && (
              <span className={`text-xs font-medium ${
                (item.price_change || 0) >= 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatChange(item.price_change || 0)}
              </span>
            )}
            {activeTab === 'traded' && item.total_supply !== undefined && (
              <span className="text-xs text-muted-foreground">
                {item.total_supply} tokens
              </span>
            )}
          </div>
        </div>
        
        {/* 화살표 */}
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </Card>
    </Link>
  );

  return (
    <>
      <Helmet>
        <title>Trending Now - KTRENDZ</title>
        <meta name="description" content="Discover trending K-Pop tokens and top gainers" />
      </Helmet>

      <V2Layout pcHeaderTitle="Trending Now" showBackButton={true}>
        <div className={`${isMobile ? 'px-4' : 'flex gap-6'} py-4`}>
          {/* 메인 컨텐츠 */}
          <div className={isMobile ? '' : 'flex-1'}>
            {/* 탭 */}
            <div className="mb-4">
              {TabsComponent}
            </div>

            {/* 리스트 */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {currentData.map((item: any, idx) => renderItem(item, idx))}
              </div>
            )}
          </div>

          {/* PC에서만 Bot Trading Activity 사이드바 표시 */}
          {!isMobile && (
            <div className="w-80 flex-shrink-0">
              <BotTradingActivity className="sticky top-20" />
            </div>
          )}
        </div>
      </V2Layout>
    </>
  );
};

export default TrendingRankings;
