import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, ChevronRight, ChevronLeft } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SmartImage from "@/components/SmartImage";
import { formatPrice, formatChange } from "./LivePriceTicker";

interface Artist {
  id: string;
  title: string;
  slug: string;
  image_url?: string | null;
  metadata?: any;
  community_fund?: number;
  fanz_token?: {
    current_price?: number;
    price_change?: number;
  };
}

interface HotArtistsCarouselProps {
  artists: Artist[];
}

// Fund 포맷 함수 - 항상 소수 둘째자리까지 표시
const formatFund = (amount: number): string => {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

const HotArtistsCarousel = ({ artists }: HotArtistsCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 스크롤 상태 업데이트
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState, artists]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -220 : 220;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="pt-5 pb-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Hot Artists</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* PC 전용 좌우 화살표 */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7 rounded-full"
              disabled={!canScrollLeft}
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7 rounded-full"
              disabled={!canScrollRight}
              onClick={() => scroll("right")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Link 
            to="/artists" 
            className="text-xs text-muted-foreground flex items-center active:text-primary"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      
      <div className="relative overflow-hidden">
        <div
          ref={scrollRef}
          className="flex gap-3 px-4 pb-3 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {artists.map((artist, idx) => (
            <Link
              key={artist.id}
              to={`/k/${artist.slug}`}
              className="flex-shrink-0 w-[200px] md:w-[240px] active:scale-95 transition-transform duration-150"
            >
              <Card className="overflow-hidden bg-card border-0 shadow-card rounded-2xl">
                {/* 이미지 */}
                <div className="relative w-full h-[160px] md:h-[200px] bg-muted">
                  <SmartImage
                    src={artist.image_url || artist.metadata?.profile_image}
                    alt={artist.title}
                    className="w-full h-full object-cover"
                  />
                  {/* 랭킹 뱃지 */}
                  <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
                    {idx + 1}
                  </div>
                  {/* HOT 뱃지 - 상위 3개만 */}
                  {idx < 3 && (
                    <Badge className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 h-5 rounded-none rounded-bl-lg rounded-tr-2xl font-semibold">
                      🔥 HOT
                    </Badge>
                  )}
                  {/* Fund 뱃지 */}
                  {(() => {
                    const fund = artist.community_fund ?? 0;
                    if (fund <= 0) return null;
                    return (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2 py-1 text-[10px]">
                        <span className="font-semibold">
                          <span className="text-white/60">Fund</span>{" "}
                          <span className="text-white">{formatFund(fund)}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* 정보 */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {artist.title}
                  </p>
                  {artist.fanz_token && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(artist.fanz_token.current_price || 0)}
                      </span>
                      <span className={`text-xs font-semibold ${
                        (artist.fanz_token.price_change || 0) >= 0 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`}>
                        {formatChange(artist.fanz_token.price_change || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HotArtistsCarousel;
