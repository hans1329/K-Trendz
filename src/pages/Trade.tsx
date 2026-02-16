import { useLayoutEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, TrendingUp, Activity, Wand2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartImage from "@/components/SmartImage";
import AppTabBar from "@/components/home/AppTabBar";
import BuyFanzTokenDialog from "@/components/BuyFanzTokenDialog";
import { useHotTokensData, HotTokenItem } from "@/hooks/useHotTokensData";
import { getAvatarThumbnail } from "@/lib/image";
import { useQueryClient } from "@tanstack/react-query";

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

const Trade = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'trending' | 'gainers' | 'traded'>('trending');
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<HotTokenItem | null>(null);

  // 고정 헤더 레이아웃 적용
  useLayoutEffect(() => {
    document.body.classList.add("v2-fixed-header");
    return () => {
      document.body.classList.remove("v2-fixed-header");
    };
  }, []);

  // 공통 훅을 사용해 데이터 조회 (온체인 가격 + 24h 변동률 포함)
  const { data: trendingData = [], isLoading } = useHotTokensData({ limit: 50, sortBy: 'trending' });
  
  // Gainers: 가격 상승률 기준 정렬
  const gainersData = useMemo(() => {
    return [...trendingData].sort((a, b) => b.price_change - a.price_change);
  }, [trendingData]);
  
  // Traded: 거래량(total_supply) 기준 정렬
  const tradedData = useMemo(() => {
    return [...trendingData].sort((a, b) => b.total_supply - a.total_supply);
  }, [trendingData]);

  const currentData = activeTab === 'trending' ? trendingData : activeTab === 'gainers' ? gainersData : tradedData;

  // Buy 버튼 클릭 시 구매 모달 열기
  const handleQuickBuy = (token: HotTokenItem) => {
    if (!token.fanz_token_db_id) {
      // 토큰이 없으면 상세 페이지로 이동
      navigate(`/k/${token.slug}`);
      return;
    }
    setSelectedToken(token);
    setBuyDialogOpen(true);
  };

  const handlePurchaseSuccess = () => {
    setBuyDialogOpen(false);
    setSelectedToken(null);
    // 데이터 새로고침
    queryClient.invalidateQueries({ queryKey: ['hot-tokens-unified'] });
  };

  return (
    <>
      <Helmet>
        <title>Trade Now - KTRENDZ</title>
        <meta name="description" content="Buy and trade K-Pop fan tokens" />
      </Helmet>
      
      {/* 고정 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center -ml-2 active:bg-muted rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Trade Now</h1>
          <div className="w-10" />
        </div>
        
        {/* 탭 */}
        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/50">
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
                Most Traded
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      
      <main className="min-h-screen bg-background pt-[120px] pb-24">
        {isLoading ? (
          <div className="px-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {currentData.map((token, idx) => (
              <Card 
                key={token.id} 
                className="p-4 bg-card border-0 shadow-sm rounded-2xl active:scale-[0.98] transition-transform duration-150"
              >
                <div className="flex items-center gap-3">
                  {/* 순위 */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    idx < 3 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  
                  {/* 이미지 - 클릭시 상세 페이지로 */}
                  <Link to={`/k/${token.slug}`} className="shrink-0">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted">
                      <SmartImage
                        src={getAvatarThumbnail(token.image_url) || token.metadata?.profile_image}
                        alt={token.title}
                        className="w-full h-full object-cover"
                      />
                      {idx < 3 && (
                        <Badge className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[8px] px-1 py-0 h-4 rounded-bl-md rounded-tr-xl font-semibold">
                          🔥
                        </Badge>
                      )}
                    </div>
                  </Link>
                  
                  {/* 정보 - 클릭시 상세 페이지로 */}
                  <Link to={`/k/${token.slug}`} className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {token.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base font-bold text-foreground">
                        {formatPrice(token.current_price)}
                      </span>
                      {activeTab !== 'traded' ? (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          token.price_change >= 0 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-red-500/10 text-red-600'
                        }`}>
                          {formatChange(token.price_change)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {token.total_supply} sold
                        </span>
                      )}
                    </div>
                  </Link>
                  
                  {/* Buy 버튼 */}
                  <Button 
                    size="sm" 
                    className="rounded-full h-9 px-4 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-all duration-150 shrink-0"
                    onClick={() => handleQuickBuy(token)}
                  >
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                    Buy
                  </Button>
                </div>
              </Card>
            ))}
            
            {currentData.length === 0 && (
              <Card className="p-8 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No tokens available</p>
              </Card>
            )}
          </div>
        )}
      </main>
      
      {/* 하단 탭 바 */}
      <AppTabBar />

      {/* 구매 다이얼로그 */}
      {selectedToken && selectedToken.fanz_token_db_id && (
        <BuyFanzTokenDialog
          open={buyDialogOpen}
          onOpenChange={setBuyDialogOpen}
          tokenId={selectedToken.fanz_token_db_id}
          onchainBuyCostUsd={selectedToken.raw_buy_cost || 0.35}
          currentSupply={selectedToken.total_supply}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}
    </>
  );
};

export default Trade;
