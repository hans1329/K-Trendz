import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface WikiImageCardProps {
  wikiEntrySlug: string;
  imageUrl: string | null;
  title: string;
  size?: "small" | "medium" | "large";
  trendingScore?: number;
}

const WikiImageCard = ({ wikiEntrySlug, imageUrl, title, size = "medium", trendingScore }: WikiImageCardProps) => {
  const [imageError, setImageError] = useState(false);
  const { isAdmin } = useAuth();

  // 크기별 스타일 설정
  const sizeClasses = {
    small: "w-24 h-24 rounded-md",
    medium: "w-48 h-48 lg:w-60 lg:h-60 rounded-lg",
    large: "w-full h-48 rounded-lg"
  };

  const badgeClasses = {
    small: "absolute bottom-1 right-1 text-xs px-1.5 py-0.5 bg-black/50 backdrop-blur-sm border-white/50 text-white",
    medium: "absolute bottom-2 right-2 text-xs px-2 py-0.5 bg-black/50 backdrop-blur-sm border-white/50 text-white",
    large: "absolute bottom-2 right-2 text-sm px-2 py-1 bg-black/50 backdrop-blur-sm border-white/50 text-white"
  };

  const iconSize = {
    small: "w-8 h-8",
    medium: "w-12 h-12",
    large: "w-16 h-16"
  };

  // 외부 이미지 URL을 프록시를 통해 로드
  const getProxiedImageUrl = (url: string | null) => {
    if (!url) return null;
    
    // Supabase Storage URL은 프록시 불필요
    if (url.includes('supabase.co/storage')) {
      return url;
    }
    
    // whicdn.com은 접속 불가능한 도메인이므로 항상 에러 처리
    if (url.includes('whicdn.com')) {
      console.warn('Skipping unavailable whicdn.com image:', url);
      return null;
    }
    
    // 외부 URL은 프록시 사용
    try {
      return `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
    } catch (e) {
      console.error('Failed to create proxied URL:', e);
      return null;
    }
  };

  const proxiedImageUrl = getProxiedImageUrl(imageUrl);

  return (
    <div className="flex-shrink-0">
      <Link 
        to={`/k/${wikiEntrySlug}`} 
        className="relative block"
      >
        <div className={`${sizeClasses[size]} overflow-hidden bg-muted hover:opacity-90 transition-opacity flex items-center justify-center relative`}>
          {proxiedImageUrl && !imageError ? (
            <img 
              src={proxiedImageUrl} 
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <User className={`${iconSize[size]} text-muted-foreground`} />
          )}
          {isAdmin && trendingScore !== undefined && (
            <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-[#ff4500] backdrop-blur-sm border-white/30 text-white font-semibold">
              {trendingScore}
            </Badge>
          )}
        </div>
      </Link>
    </div>
  );
};

export default WikiImageCard;
