import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Wallet, Sparkles, Trophy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { formatPrice, formatChange } from "./LivePriceTicker";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
interface HeroBannerCarouselProps {
  userId: string | null;
}
const HeroBannerCarousel = ({
  userId
}: HeroBannerCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  // 캐러셀 API 연결
  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // 도트 클릭 핸들러
  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);

  // 포트폴리오 데이터 가져오기
  const {
    data: portfolio,
    isLoading
  } = usePortfolioSummary(userId);
  const totalValue = portfolio?.totalValue || 0;
  const totalChange = portfolio?.totalChange || 0;
  const holdings = portfolio?.holdings || [];

  // 퀴즈쇼 배너 컴포넌트
  const QuizShowBanner = () => <Link to="/challenges" className="block h-full group">
      <Card className="p-4 border-0 shadow-card rounded-xl h-40 md:h-44 relative overflow-hidden bg-[length:200%_200%] bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 animate-gradient-shift will-change-auto">
        {/* 배경 장식 - 트로피 아이콘 */}
        <div className="absolute top-2 right-2 opacity-20 animate-trophy-wiggle will-change-transform">
          <Trophy className="text-white w-[50px] h-[50px]" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-4 h-4 text-white" />
              <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">Daily Challenge</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
              Win USDC Prizes!
            </h3>
            <p className="text-sm text-white/80 mt-1">
              Answer K-Pop trivia & earn rewards
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">New challenges daily</span>
            <span className="text-xs font-semibold text-white flex items-center group-hover:translate-x-0.5 transition-transform">
              Play Now <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Card>
    </Link>;

  // 포트폴리오 카드 컴포넌트
  const PortfolioCard = () => {
    if (isLoading && userId) {
      // 로딩 중: 스켈레톤
      return <Card className="p-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 border-0 shadow-card rounded-xl h-40 md:h-44">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Skeleton className="w-4 h-4 rounded bg-white/30" />
            <Skeleton className="w-20 h-3 rounded bg-white/30" />
          </div>
          <Skeleton className="w-32 h-8 rounded bg-white/30 mb-3" />
          <div className="flex -space-x-1.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="w-9 h-9 rounded-full bg-white/30" />)}
          </div>
        </Card>;
    }
    if (userId) {
      // 로그인한 경우: 포트폴리오 요약
      return <Card className="p-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 border-0 shadow-card rounded-xl h-40 md:h-44">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-white" />
              <h3 className="font-semibold text-white text-xs">My Portfolio</h3>
            </div>
            <Link to="/my-fanz" className="text-[10px] text-white/80 flex items-center font-medium active:underline hover:text-white">
              Details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl md:text-3xl font-bold text-white">{formatPrice(totalValue)}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${totalChange >= 0 ? 'text-green-300 bg-white/20' : 'text-red-300 bg-white/20'}`}>
              {formatChange(totalChange)}
            </span>
          </div>
          
          {holdings.length > 0 ? <div className="flex -space-x-1.5">
              {holdings.slice(0, 5).map((holding: any) => <Avatar key={holding.id} className="w-9 h-9 border-2 border-white/30">
                  <AvatarImage src={holding.image_url} />
                  <AvatarFallback className="text-[10px] bg-white/20 text-white font-medium">
                    {holding.name?.[0]}
                  </AvatarFallback>
                </Avatar>)}
              {holdings.length > 5 && <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold text-white">
                  +{holdings.length - 5}
                </div>}
            </div> : <p className="text-[10px] text-white/70">No tokens yet. Start collecting!</p>}
        </Card>;
    }

    // 로그인하지 않은 경우: CTA 카드
    return <Card className="p-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 border-0 shadow-card rounded-xl h-40 md:h-44">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/70">Start your K-Pop investment</p>
            <p className="text-lg font-bold text-white">Sign in to view portfolio</p>
          </div>
        </div>
        <Link to="/auth">
          <Button className="w-full mt-3 rounded-full h-10 font-semibold text-base bg-white/20 hover:bg-white/30 text-white border-0">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Get Started
          </Button>
        </Link>
      </Card>;
  };
  return <section className="px-4 py-2.5">
      {/* PC: 그리드 레이아웃으로 나란히 표시 (3:2 비율) */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-4">
        <div className="col-span-3">
          <QuizShowBanner />
        </div>
        <div className="col-span-2">
          <PortfolioCard />
        </div>
      </div>

      {/* 모바일: 캐러셀 */}
      <div className="md:hidden">
        <Carousel setApi={setApi} opts={{
        align: "center",
        loop: true
      }} plugins={[Autoplay({
        delay: 6000,
        stopOnInteraction: false,
        stopOnMouseEnter: true
      })]} className="w-full">
          <CarouselContent>
            {/* 슬라이드 1: 퀴즈쇼 배너 */}
            <CarouselItem className="basis-full">
              <QuizShowBanner />
            </CarouselItem>

            {/* 슬라이드 2: 포트폴리오 카드 */}
            <CarouselItem className="basis-full">
              <PortfolioCard />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
        
        {/* 도트 인디케이터 - 모바일만 */}
        <div className="flex justify-center gap-1.5 mt-2">
          {Array.from({
          length: count
        }).map((_, index) => <button key={index} onClick={() => scrollTo(index)} className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${index === current ? 'bg-primary w-4' : 'bg-muted-foreground/30'}`} aria-label={`Go to slide ${index + 1}`} />)}
        </div>
      </div>
    </section>;
};
export default HeroBannerCarousel;