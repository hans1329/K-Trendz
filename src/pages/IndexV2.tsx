import { useLayoutEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateStripeTotal, fetchTokenPriceData } from "@/hooks/useFanzTokenPrice";
import { useHotTokensData } from "@/hooks/useHotTokensData";

// 앱 전용 컴포넌트들
import V2Layout from "@/components/home/V2Layout";
import LivePriceTicker from "@/components/home/LivePriceTicker";
import HotArtistsCarousel from "@/components/home/HotArtistsCarousel";
import HeroBannerCarousel from "@/components/home/HeroBannerCarousel";
import TrendingTokensGrid from "@/components/home/TrendingTokensGrid";
import NewListingsSection from "@/components/home/NewListingsSection";
import FeaturedBanner from "@/components/home/FeaturedBanner";
import ComingSoonSection from "@/components/home/ComingSoonSection";
import RankingSections from "@/components/home/RankingSections";
import BuyFanzTokenDialog from "@/components/BuyFanzTokenDialog";

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
const IndexV2 = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Buy 다이얼로그 상태
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  // 모바일에서만 v2-fixed-header 클래스 적용
  useLayoutEffect(() => {
    if (isMobile) {
      document.body.classList.add("v2-fixed-header");
      return () => {
        document.body.classList.remove("v2-fixed-header");
      };
    }
  }, [isMobile]);
  
  // Hot Artists 데이터 - Rankings 티커와 동일한 24시간 가격 변동 로직 사용
  const { data: hotTokensData = [], isLoading: artistsLoading } = useHotTokensData(10);
  
  // HotArtistsCarousel에 맞는 형태로 변환
  const hotArtists = hotTokensData.map(token => ({
    id: token.id,
    title: token.title,
    slug: token.slug,
    image_url: token.image_url,
    metadata: token.metadata,
    community_fund: token.community_fund,
    fanz_token: {
      current_price: token.current_price,
      price_change: token.price_change,
    }
  }));

  // Trending Tokens 데이터 - 온체인 가격 조회
  const { data: trendingTokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ['trending-tokens-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select(`
          id, token_id, total_supply, base_price, k_value, created_at,
          wiki_entries:wiki_entry_id (id, title, slug, image_url, metadata)
        `)
        .eq('is_active', true)
        .order('total_supply', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      if (!data) return [];
      
      // 온체인 가격 병렬 조회
      const tokensWithPrices = await Promise.all(
        data.map(async (token) => {
          try {
            const priceData = await fetchTokenPriceData(token.token_id);
            
            if (priceData?.isOnchainData && priceData?.buyCost) {
              const rawBuyCost = priceData.buyCost;
              const displayPrice = calculateStripeTotal(rawBuyCost);
              return {
                ...token,
                wiki_entry: token.wiki_entries,
                current_price: displayPrice,
                raw_buy_cost: rawBuyCost,
                total_supply: priceData.totalSupply ?? token.total_supply,
                price_change: 0,
              };
            }
          } catch (e) {
            console.warn('Failed to fetch onchain price for', token.id);
          }
          
          // 폴백: DB 데이터로 계산
          const kValueScaled = token.k_value / 1e12;
          const bondingPrice = token.base_price + (kValueScaled * Math.sqrt(token.total_supply));
          const currentPrice = calculateStripeTotal(bondingPrice);
          return {
            ...token,
            wiki_entry: token.wiki_entries,
            current_price: currentPrice,
            raw_buy_cost: bondingPrice,
            price_change: 0,
          };
        })
      );
      
      return tokensWithPrices;
    },
    staleTime: 5 * 60 * 1000, // 5분 캐싱
    gcTime: 10 * 60 * 1000,   // 10분 GC
  });

  // New Listings 데이터 - 온체인 가격 조회
  const { data: newListings = [] } = useQuery({
    queryKey: ['new-listings-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select(`
          id, token_id, total_supply, base_price, k_value, created_at,
          wiki_entries:wiki_entry_id (id, title, slug, image_url, metadata)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
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
          const currentPrice = calculateStripeTotal(bondingPrice);
          return {
            ...token,
            wiki_entry: token.wiki_entries,
            current_price: currentPrice,
          };
        })
      );
      
      return tokensWithPrices;
    },
    staleTime: 5 * 60 * 1000, // 5분 캐싱
    gcTime: 10 * 60 * 1000,   // 10분 GC
  });

  // Quick Buy 핸들러
  const handleQuickBuy = (token: any) => {
    setSelectedToken(token);
    setBuyDialogOpen(true);
  };
  
  // 구매 성공 핸들러
  const handlePurchaseSuccess = () => {
    setBuyDialogOpen(false);
    setSelectedToken(null);
    // 데이터 새로고침을 위해 쿼리 무효화
    window.dispatchEvent(new CustomEvent('fanzTokenUpdated'));
  };

  // PC 헤더용 티커 컴포넌트
  const headerTicker = <LivePriceTicker tokens={trendingTokens} />;

  const content = (
    <main className="min-h-screen bg-background">
      {/* Live Price Ticker - 모바일에서만 표시 (PC는 헤더에 표시) */}
      <div className="md:hidden">
        <LivePriceTicker tokens={trendingTokens} />
      </div>
      
      {/* 나머지 콘텐츠 - PC에서 폭 제한 */}
      <div className="md:max-w-4xl md:mx-auto md:px-4">
        {/* Hero Banner Carousel (Portfolio + Quiz Show) */}
        <HeroBannerCarousel userId={user?.id || null} />
        {/* Hot Artists Carousel */}
        {artistsLoading ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="w-20 h-5" />
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-shrink-0">
                  <Skeleton className="w-20 h-20 rounded-2xl" />
                  <Skeleton className="w-14 h-3 mt-2 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <HotArtistsCarousel artists={hotArtists} />
        )}
        
        {/* Featured Banner */}
        <FeaturedBanner />
        
        {/* Ranking Sections (Trending, Gainers, Most Traded) */}
        <RankingSections />
        
        {/* Trending Tokens Grid */}
        {tokensLoading ? (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="w-24 h-5" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <TrendingTokensGrid tokens={trendingTokens} onQuickBuy={handleQuickBuy} />
        )}
        
        {/* New Listings */}
        <NewListingsSection tokens={newListings} />
        
        {/* Coming Soon (Locked Tokens) */}
        <ComingSoonSection />
      </div>
    </main>
  );

  return (
    <>
      <Helmet>
        <title>KTRENDZ - K-Pop Fan Token Platform</title>
        <meta name="description" content="Support your favorite K-Pop artists with FanzTokens. Trade, collect, and earn rewards." />
      </Helmet>
      
      <V2Layout pcHeaderTitle="K-Pop Supporters" headerContent={headerTicker}>
        {content}
      </V2Layout>
      
      {/* Buy 다이얼로그 */}
      {selectedToken && (
        <BuyFanzTokenDialog
          open={buyDialogOpen}
          onOpenChange={setBuyDialogOpen}
          tokenId={selectedToken.id}
          onchainBuyCostUsd={selectedToken.raw_buy_cost || selectedToken.current_price || 0.1}
          currentSupply={selectedToken.total_supply || 0}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}
    </>
  );
};

export default IndexV2;
