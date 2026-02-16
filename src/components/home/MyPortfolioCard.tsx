import { Link } from "react-router-dom";
import { Wallet, Sparkles, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatChange } from "./LivePriceTicker";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";

interface MyPortfolioCardProps {
  userId: string | null;
}

const MyPortfolioCard = ({ userId }: MyPortfolioCardProps) => {
  const { data: portfolio, isLoading } = usePortfolioSummary(userId);

  // 로그인하지 않은 경우
  if (!userId) {
    return (
      <section className="px-4 py-2.5">
        <Card className="p-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 border-0 shadow-card rounded-xl">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70">Start your K-Pop investment</p>
              <p className="text-base font-bold text-white">Sign in to view portfolio</p>
            </div>
          </div>
          <Link to="/auth">
            <Button className="w-full mt-2.5 rounded-full h-9 font-semibold text-sm bg-white/20 hover:bg-white/30 text-white border-0">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Get Started
            </Button>
          </Link>
        </Card>
      </section>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <section className="px-4 py-2.5">
        <Card className="p-3.5 bg-card border-0 shadow-card rounded-xl">
          {/* 헤더 스켈레톤 */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-20 h-3 rounded" />
            </div>
            <Skeleton className="w-12 h-3 rounded" />
          </div>
          
          {/* 금액 스켈레톤 */}
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <Skeleton className="w-24 h-6 rounded" />
            <Skeleton className="w-12 h-4 rounded" />
          </div>
          
          {/* 아바타 스켈레톤 */}
          <div className="flex -space-x-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="w-7 h-7 rounded-full border-2 border-card" />
            ))}
          </div>
        </Card>
      </section>
    );
  }

  const totalValue = portfolio?.totalValue || 0;
  const totalChange = portfolio?.totalChange || 0;
  const holdings = portfolio?.holdings || [];

  return (
    <section className="px-4 py-2.5">
      <Card className="p-3.5 bg-card border-0 shadow-card rounded-xl">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">My Portfolio</h3>
          </div>
          <Link 
            to="/my-fanz" 
            className="text-xs text-primary flex items-center font-medium active:underline"
          >
            Details <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        <div className="flex items-baseline gap-1.5 mb-2.5">
          <span className="text-2xl font-bold text-foreground">{formatPrice(totalValue)}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            totalChange >= 0 
              ? 'text-green-600 bg-green-500/10' 
              : 'text-red-600 bg-red-500/10'
          }`}>
            {formatChange(totalChange)}
          </span>
        </div>
        
        {holdings.length > 0 ? (
          <div className="flex -space-x-1">
            {holdings.slice(0, 5).map((holding: any) => (
              <Avatar key={holding.id} className="w-8 h-8 border-2 border-card">
                <AvatarImage src={holding.image_url} />
                <AvatarFallback className="text-[10px] bg-muted font-medium">
                  {holding.name?.[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {holdings.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{holdings.length - 5}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tokens yet. Start collecting!</p>
        )}
      </Card>
    </section>
  );
};

export default MyPortfolioCard;
