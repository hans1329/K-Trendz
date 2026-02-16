import { Lock, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import SmartImage from "@/components/SmartImage";
import { cn } from "@/lib/utils";

// v1 Rankings의 잠금 카드 로직을 사용 (1000표 미만 & 토큰 미발행)
const ComingSoonSection = () => {
  // fanz_tokens가 없고 votes < 1000인 아티스트/멤버 가져오기
  const { data: lockedArtists = [] } = useQuery({
    queryKey: ['locked-artists-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select(`
          id, title, slug, image_url, metadata, votes, trending_score,
          fanz_tokens (id)
        `)
        .in('schema_type', ['artist', 'member'])
        .not('content', 'is', null)
        .lt('votes', 1000)
        .order('votes', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // fanz_tokens가 없는 것만 필터링
      return (data || []).filter((entry: any) => 
        !entry.fanz_tokens || entry.fanz_tokens.length === 0
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  if (lockedArtists.length === 0) return null;

  return (
    <section className="px-4 pt-0 pb-28 md:py-4 md:pb-28">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground">Locked Artists</h2>
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">
          Vote to Unlock
        </Badge>
      </div>
      
      {/* 모바일 2열, PC 3열 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {lockedArtists.map((entry: any) => {
          const displayImage = entry.image_url || entry.metadata?.profile_image;
          const votes = entry.votes || 0;
          const voteProgress = Math.min((votes / 1000) * 100, 100);
          
          // 투표 단계에 따른 잠금 상태
          const isFullLocked = votes < 500;
          
          return (
            <Link 
              key={entry.id}
              to={`/k/${entry.slug}`}
              className="block active:scale-95 transition-transform duration-150"
            >
              <Card className="overflow-hidden border-0 shadow-card bg-card">
                {/* 이미지 영역 */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <SmartImage
                    src={displayImage}
                    alt={entry.title}
                    className={cn(
                      "w-full h-full object-cover",
                      isFullLocked ? "brightness-[0.25]" : "brightness-[0.5]"
                    )}
                    fallback={
                      <div className={cn(
                        "w-full h-full flex items-center justify-center",
                        isFullLocked ? "bg-black/80" : "bg-black/60"
                      )}>
                        <Lock className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                    }
                  />
                  
                  {/* 잠금 오버레이 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    {isFullLocked ? (
                      <>
                        <Lock className="w-8 h-8 text-white/80" />
                        <span className="mt-1 text-xs text-white/80 font-medium">Locked</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-8 h-8 text-primary animate-pulse" />
                        <span className="mt-1 text-xs text-white/80 font-medium">Almost Ready!</span>
                      </>
                    )}
                  </div>
                  
                  {/* 진행률 바 - 하단 */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 z-20">
                    <div className="flex items-center justify-between text-[10px] text-white/80 mb-1">
                      <span>Votes</span>
                      <span>{votes.toLocaleString()} / 1,000</span>
                    </div>
                    <Progress 
                      value={voteProgress} 
                      className="h-1.5 bg-white/20" 
                      indicatorClassName={cn(
                        votes < 100 ? "bg-gray-400" : 
                        votes < 500 ? "bg-blue-500" : 
                        votes < 800 ? "bg-green-500" : 
                        "bg-primary"
                      )} 
                    />
                  </div>
                </div>
                
                {/* 타이틀 영역 */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-1">{entry.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {votes >= 500 ? "Ready to unlock!" : `${1000 - votes} votes to unlock`}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ComingSoonSection;
