import { useLayoutEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, TrendingUp, Trophy, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import SmartImage from "@/components/SmartImage";
import AppTabBar from "@/components/home/AppTabBar";
import { formatPrice, formatChange } from "@/components/home/LivePriceTicker";
import { useHotTokensData } from "@/hooks/useHotTokensData";

const ArtistRankings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'hot' | 'gainers' | 'new'>('hot');

  // 고정 헤더 레이아웃 적용
  useLayoutEffect(() => {
    document.body.classList.add("v2-fixed-header");
    return () => {
      document.body.classList.remove("v2-fixed-header");
    };
  }, []);

  // 공통 훅을 사용해 Hot 아티스트 데이터 (온체인 가격 + 24h 변동률 포함)
  const { data: hotArtists = [], isLoading: isLoadingHot } = useHotTokensData({ limit: 50, sortBy: 'trending' });

  // New 탭용 데이터 (최근 생성순)
  const { data: newArtists = [], isLoading: isLoadingNew } = useQuery({
    queryKey: ['artist-rankings-new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, image_url, metadata, created_at')
        .in('schema_type', ['artist', 'member'])
        .not('content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === 'new',
    staleTime: 5 * 60 * 1000,
  });

  // 탭에 따른 데이터 선택 및 정렬
  const { displayArtists, isLoading } = useMemo(() => {
    if (activeTab === 'hot') {
      return { displayArtists: hotArtists, isLoading: isLoadingHot };
    } else if (activeTab === 'gainers') {
      // 가격 상승률 기준 정렬
      const sorted = [...hotArtists].sort((a, b) => b.price_change - a.price_change);
      return { displayArtists: sorted, isLoading: isLoadingHot };
    } else {
      // New 탭: 토큰 정보 없이 표시
      return { 
        displayArtists: newArtists.map(a => ({
          ...a,
          current_price: 0,
          price_change: 0,
          total_supply: 0,
          community_fund: 0,
          follower_count: 0,
        })), 
        isLoading: isLoadingNew 
      };
    }
  }, [activeTab, hotArtists, newArtists, isLoadingHot, isLoadingNew]);

  return (
    <>
      <Helmet>
        <title>Hot Artists - KTRENDZ</title>
        <meta name="description" content="Discover trending K-Pop artists and their FanzTokens" />
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
          <h1 className="text-lg font-bold">Hot Artists</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* 탭 */}
        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/50">
              <TabsTrigger value="hot" className="text-sm gap-1.5">
                <Flame className="w-4 h-4" />
                Hot
              </TabsTrigger>
              <TabsTrigger value="gainers" className="text-sm gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Top Voted
              </TabsTrigger>
              <TabsTrigger value="new" className="text-sm gap-1.5">
                <Trophy className="w-4 h-4" />
                New
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      
      <main className="min-h-screen bg-background pt-[120px] pb-24">
        {isLoading ? (
          <div className="px-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {displayArtists.map((artist, idx) => (
              <Link
                key={artist.id}
                to={`/k/${artist.slug}`}
                className="block active:scale-[0.98] transition-transform duration-150"
              >
                <Card className="flex items-center gap-3 p-3 bg-card border-0 shadow-sm rounded-2xl">
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
                      src={artist.image_url || artist.metadata?.profile_image}
                      alt={artist.title}
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
                      {artist.title}
                    </p>
                    {artist.current_price > 0 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-foreground">
                          {formatPrice(artist.current_price)}
                        </span>
                        <span className={`text-xs font-medium ${
                          artist.price_change >= 0 
                            ? 'text-green-500' 
                            : 'text-red-500'
                        }`}>
                          {formatChange(artist.price_change)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 화살표 */}
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      
      {/* 하단 탭 바 */}
      <AppTabBar />
    </>
  );
};

export default ArtistRankings;
