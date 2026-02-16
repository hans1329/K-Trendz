import { Link } from "react-router-dom";

// 가격 포맷터 - 항상 소수점 둘째자리까지
const formatPrice = (price: number) => {
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
};

// 컴팩트 가격 (티커용)
const formatPriceCompact = (price: number) => {
  return `$${price.toFixed(2)}`;
};

// 변동률 포맷터 - 소수점 첫째자리
const formatChange = (change: number) => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

interface Token {
  id: string;
  current_price?: number;
  price_change?: number;
  wiki_entry?: {
    slug?: string;
    title?: string;
  } | null;
}

interface LivePriceTickerProps {
  tokens: Token[];
}

const LivePriceTicker = ({ tokens }: LivePriceTickerProps) => {
  if (!tokens || tokens.length === 0) return null;
  
  // 무한 스크롤을 위해 토큰 2배로 복제
  const duplicatedTokens = [...tokens, ...tokens];
  
  return (
    <div className="bg-muted/30 overflow-hidden border-b border-border/50">
      <div className="flex animate-marquee-seamless">
        {duplicatedTokens.map((token, idx) => (
          <Link
            key={`${token.id}-${idx}`}
            to={`/k/${token.wiki_entry?.slug || token.id}`}
            className="flex items-center gap-1.5 px-3 py-2 active:bg-primary/10 transition-colors whitespace-nowrap"
          >
            <span className="font-medium text-xs text-foreground max-w-[80px] truncate">
              {token.wiki_entry?.title || 'Unknown'}
            </span>
            <span className="text-xs font-bold text-foreground">
              {formatPriceCompact(token.current_price || 0)}
            </span>
            <span className={`text-[10px] font-semibold ${
              (token.price_change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatChange(token.price_change || 0)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default LivePriceTicker;
export { formatPrice, formatPriceCompact, formatChange };
