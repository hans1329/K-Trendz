import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";

import { Vote, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveProposal {
  id: string;
  title: string;
  proposal_type: string;
  voting_end_at: string;
  total_votes_for: number;
  total_votes_against: number;
  total_vote_weight: number;
  wiki_entry: {
    title: string;
    slug: string;
    image_url: string | null;
  } | null;
  opinion_count?: number;
}

export const ActiveVotesSection = () => {
  const { data: activeProposals = [], isLoading } = useQuery({
    queryKey: ['active-proposals-preview'],
    queryFn: async () => {
      // 진행 중인 투표 가져오기 (voting_end_at이 아직 안 지난 것)
      const { data, error } = await supabase
        .from('support_proposals')
        .select(`
          id,
          title,
          proposal_type,
          voting_end_at,
          total_votes_for,
          total_votes_against,
          total_vote_weight,
          wiki_entries!inner (
            title,
            slug,
            image_url
          )
        `)
        .eq('status', 'voting')
        .gt('voting_end_at', new Date().toISOString())
        .order('total_vote_weight', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching active proposals:', error);
        return [];
      }

      // 각 proposal의 opinion 수 가져오기
      const proposalsWithOpinions = await Promise.all(
        (data || []).map(async (proposal: any) => {
          const { count } = await supabase
            .from('support_proposal_opinions')
            .select('id', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id);

          return {
            ...proposal,
            wiki_entry: proposal.wiki_entries,
            opinion_count: count || 0,
          };
        })
      );

      return proposalsWithOpinions as ActiveProposal[];
    },
    staleTime: 60000, // 1분 캐시
    refetchInterval: 120000, // 2분마다 새로고침
  });

  // 남은 시간 계산
  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
  };

  // 스크롤 컨테이너 ref 및 상태
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 스크롤 상태 업데이트
  const updateScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [activeProposals]);

  // 스크롤 함수
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollAmount = 220; // 카드 너비 + gap
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // 데이터가 없거나 로딩 중이면 렌더링하지 않음
  if (isLoading || activeProposals.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Fan Proposals</h3>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {activeProposals.length}
          </Badge>
        </div>
        
        {/* PC 좌우 화살표 */}
        <div className="hidden sm:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full",
              !canScrollLeft && "opacity-30 cursor-not-allowed"
            )}
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full",
              !canScrollRight && "opacity-30 cursor-not-allowed"
            )}
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Proposal Cards - Horizontal Scroll */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
      >
        {activeProposals.map((proposal) => {
          const totalVotes = proposal.total_votes_for + proposal.total_votes_against;
          const forPercentage = totalVotes > 0 
            ? Math.round((proposal.total_votes_for / totalVotes) * 100) 
            : 50;

            return (
              <Link
                key={proposal.id}
                to={`/k/${proposal.wiki_entry?.slug}?tab=proposals`}
                className="flex-shrink-0 w-[200px] bg-white/10 border border-white/20 rounded-xl overflow-hidden hover:bg-white/15 hover:shadow-lg hover:shadow-primary/10 transition-all group"
              >
                {/* Large Image */}
                <div className="relative aspect-square w-full">
                  <img 
                    src={proposal.wiki_entry?.image_url || '/placeholder.svg'} 
                    alt={proposal.wiki_entry?.title || ''} 
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                  
                  {/* Time Badge */}
                  <div className={cn(
                    "absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm",
                    getTimeRemaining(proposal.voting_end_at).includes('m left') 
                      ? "bg-red-500/80 text-white" 
                      : getTimeRemaining(proposal.voting_end_at).includes('h left')
                        ? "bg-orange-500/80 text-white"
                        : "bg-black/50 text-white/90"
                  )}>
                    {getTimeRemaining(proposal.voting_end_at)}
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[10px] text-white/70 truncate mb-0.5">{proposal.wiki_entry?.title}</p>
                    <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{proposal.title}</p>
                    
                    {/* Vote Progress Bar */}
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden flex mt-2">
                      <div 
                        className="bg-gradient-to-r from-emerald-400 to-green-500 transition-all" 
                        style={{ width: `${forPercentage}%` }}
                      />
                      <div 
                        className="bg-white/30 transition-all" 
                        style={{ width: `${100 - forPercentage}%` }}
                      />
                    </div>
                    
                    {/* Participants */}
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/70">
                      <span>{proposal.opinion_count} participants</span>
                      <span className="font-medium text-emerald-400">{forPercentage}% Agree</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
        })}
      </div>
    </div>
  );
};

export default ActiveVotesSection;
