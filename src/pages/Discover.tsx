import { Link } from "react-router-dom";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { getAvatarThumbnail } from "@/lib/image";
import { useHotTokensData } from "@/hooks/useHotTokensData";
import BotTradingActivity from "@/components/home/BotTradingActivity";

const Discover = () => {
  const isMobile = useIsMobile();

  // 공통 훅을 사용하여 가격이 낮은 순으로 정렬된 토큰 조회
  const { data: tokens, isLoading } = useHotTokensData({ limit: 50, sortBy: 'price_asc' });

  return (
    <V2Layout pcHeaderTitle="Discover" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : 'flex gap-6'} py-4`}>
        {/* 메인 컨텐츠 */}
        <div className={isMobile ? '' : 'flex-1'}>
          {/* 헤더 배너 */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white p-5 rounded-2xl mb-6">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-semibold opacity-90">Rising Stars</span>
              </div>
              <h2 className="text-lg font-bold mb-1">Support Emerging Artists</h2>
              <p className="text-sm opacity-85 leading-relaxed">
                Discover affordable lightsticks and grow with your favorite artists
              </p>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 right-4 w-16 h-16 bg-white/10 rounded-full translate-y-1/2" />
          </Card>

          {/* 아티스트 목록 */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tokens?.map((token, index) => (
                <Link key={token.id} to={`/k/${token.slug}`}>
                  <Card className="p-4 hover:bg-muted/50 transition-colors active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                      {/* 순위 */}
                      <div className="w-6 text-center">
                        <span className={`text-sm font-bold ${index < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {index + 1}
                        </span>
                      </div>
                      
                      {/* 아바타 */}
                      <Avatar className="w-12 h-12 ring-2 ring-border">
                        <AvatarImage src={getAvatarThumbnail(token.image_url)} />
                        <AvatarFallback className="bg-muted text-sm font-medium">
                          {token.title?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {token.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{token.follower_count || 0} fans</span>
                        </div>
                      </div>
                      
                      {/* 가격 */}
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-primary">
                          <Wand2 className="w-3.5 h-3.5" />
                          <span className="font-bold text-sm">
                            ${token.current_price.toFixed(2)}
                          </span>
                        </div>
                        {token.total_supply > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {token.total_supply} sold
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
              
              {tokens?.length === 0 && (
                <Card className="p-8 text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No rising stars found</p>
                </Card>
              )}
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
  );
};

export default Discover;
