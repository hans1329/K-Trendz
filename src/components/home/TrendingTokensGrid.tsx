import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatPrice, formatChange } from "./LivePriceTicker";
interface Token {
  id: string;
  current_price?: number;
  price_change?: number;
  wiki_entry?: {
    id?: string;
    title?: string;
    slug?: string;
    image_url?: string | null;
    metadata?: any;
  };
}
interface TrendingTokensGridProps {
  tokens: Token[];
  onQuickBuy?: (token: Token) => void;
}
const TrendingTokensGrid = ({
  tokens,
  onQuickBuy
}: TrendingTokensGridProps) => {
  return <section className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          
          <h2 className="text-lg font-bold text-foreground">Trade Now</h2>
        </div>
        <Link to="/trade" className="text-xs text-muted-foreground flex items-center active:text-primary">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {tokens.slice(0, 4).map((token, idx) => <Link key={token.id} to={`/k/${token.wiki_entry?.slug || token.id}`} className="active:scale-[0.98] transition-transform duration-150">
            <Card className="p-3.5 bg-card border-0 shadow-card rounded-xl">
              {/* 헤더: 아바타 + 이름/랭킹 */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarImage src={token.wiki_entry?.image_url || token.wiki_entry?.metadata?.profile_image} />
                  <AvatarFallback className="bg-muted text-sm font-medium">
                    {token.wiki_entry?.title?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">
                    {token.wiki_entry?.title}
                  </p>
                  <p className="text-xs text-muted-foreground">#{idx + 1} Trending</p>
                </div>
              </div>
              
              {/* 가격 + 변동률 */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-bold text-foreground">
                  {formatPrice(token.current_price || 0)}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${(token.price_change || 0) >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  {formatChange(token.price_change || 0)}
                </span>
              </div>
              
              {/* Buy 버튼 */}
              <Button size="sm" className="w-full rounded-full h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-all duration-150" onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onQuickBuy?.(token);
          }}>
                Buy Now
              </Button>
            </Card>
          </Link>)}
      </div>
    </section>;
};
export default TrendingTokensGrid;