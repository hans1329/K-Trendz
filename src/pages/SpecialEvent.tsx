import { useState, useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import SignupCtaBanner from "@/components/SignupCtaBanner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy, Clock, Users, ArrowBigUp, Sparkles, ThumbsUp, ThumbsDown, Flame, Hash, User, ChevronDown, ChevronUp, Lock, Wand2, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


// 플립 카운트다운 컴포넌트
const FlipCountdown = ({ targetTime }: { targetTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [flipping, setFlipping] = useState({
    hours: false,
    minutes: false,
    seconds: false,
  });
  const [prevValues, setPrevValues] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  
  // useRef로 현재 값을 추적하여 closure 문제 해결
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetTime.getTime();
      const diff = Math.max(0, target - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const current = timeLeftRef.current;
      
      // 실제로 변경된 값만 플립 애니메이션 트리거
      const newFlipping = {
        hours: hours !== current.hours,
        minutes: minutes !== current.minutes,
        seconds: seconds !== current.seconds,
      };
      
      // 변경이 있을 때만 플립 상태 업데이트
      if (newFlipping.hours || newFlipping.minutes || newFlipping.seconds) {
        setPrevValues(current);
        setFlipping(newFlipping);
        
        // 애니메이션 후 플립 상태 리셋
        setTimeout(() => {
          setFlipping({ hours: false, minutes: false, seconds: false });
        }, 350);
      }
      
      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  const FlipCard = ({ value, prevValue, label, isFlipping }: { value: number; prevValue: number; label: string; isFlipping: boolean }) => {
    const displayValue = String(value).padStart(2, '0');
    const displayPrevValue = String(prevValue).padStart(2, '0');
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ perspective: '300px' }}>
          {/* 상단 패널 - 현재 값 */}
          <div className="bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 rounded-t-lg min-w-[60px] sm:min-w-[80px] h-[36px] sm:h-[52px] shadow-lg border border-zinc-500 border-b-0 overflow-hidden flex items-end justify-center">
            <span className="text-3xl sm:text-5xl font-bold text-white font-mono leading-none translate-y-1/2">
              {displayValue}
            </span>
          </div>
          
          {/* 하단 패널 - 현재 값 */}
          <div className="bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 rounded-b-lg min-w-[60px] sm:min-w-[80px] h-[36px] sm:h-[52px] shadow-lg border border-zinc-500 border-t-0 overflow-hidden flex items-start justify-center">
            <span className="text-3xl sm:text-5xl font-bold text-white font-mono leading-none -translate-y-1/2">
              {displayValue}
            </span>
          </div>

          {/* 플립 상단 - 이전 값 (내려가는 애니메이션) */}
          {isFlipping && (
            <div 
              className="absolute inset-x-0 top-0 bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 rounded-t-lg min-w-[60px] sm:min-w-[80px] h-[36px] sm:h-[52px] border border-zinc-500 border-b-0 overflow-hidden flex items-end justify-center z-20"
              style={{ 
                animation: 'flipDown 0.3s ease-in forwards',
                transformOrigin: 'bottom center',
              }}
            >
              <span className="text-3xl sm:text-5xl font-bold text-white font-mono leading-none translate-y-1/2">
                {displayPrevValue}
              </span>
            </div>
          )}

          {/* 중앙 구분선 */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-zinc-950 z-10 -translate-y-1/2" />
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground mt-2 uppercase tracking-wider">{label}</span>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes flipDown {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-90deg); opacity: 0; }
        }
      `}</style>
      <div className="flex items-start gap-2 sm:gap-4">
        <FlipCard value={timeLeft.hours} prevValue={prevValues.hours} label="Hours" isFlipping={flipping.hours} />
        <span className="text-2xl sm:text-4xl font-bold text-primary mt-4 sm:mt-6">:</span>
        <FlipCard value={timeLeft.minutes} prevValue={prevValues.minutes} label="Minutes" isFlipping={flipping.minutes} />
        <span className="text-2xl sm:text-4xl font-bold text-primary mt-4 sm:mt-6">:</span>
        <FlipCard value={timeLeft.seconds} prevValue={prevValues.seconds} label="Seconds" isFlipping={flipping.seconds} />
      </div>
    </>
  );
};

// 브라우저 지문 생성
const generateFingerprint = async (): Promise<string> => {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width + 'x' + screen.height,
    screen.colorDepth.toString(),
  ];
  
  const data = components.join('|');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const SpecialEvent = () => {
  const isMobile = useIsMobile();
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isVoting, setIsVoting] = useState(false);
  const [voteAnimation, setVoteAnimation] = useState<'up' | 'down' | null>(null);
  const [voteAmount, setVoteAmount] = useState(1);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [prevPageStatus, setPrevPageStatus] = useState<string | null>(null);
  const [prevAggregatedVotes, setPrevAggregatedVotes] = useState<number | null>(null);
  const [showVoteAnimation, setShowVoteAnimation] = useState<'up' | 'down' | null>(null);

  // 지문 생성
  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  // 현재 활성 이벤트 가져오기
  const { data: activeEvent, isLoading: eventLoading } = useQuery({
    queryKey: ['special-event-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('special_vote_events')
        .select(`
          *,
          wiki_entries (
            id,
            title,
            slug,
            image_url,
            trending_score,
            votes,
            aggregated_votes,
            aggregated_trending_score,
            schema_type,
            page_status
          )
        `)
        .eq('is_active', true)
        .gt('end_time', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // 랭킹 계산 - /rankings(Wiki Trending) 페이지와 동일한 소스(get_trending_wiki_entries RPC) 기반으로 계산
      if (data?.wiki_entries) {
        const entry = data.wiki_entries as any;

        const { data: trendingEntries, error: trendingError } = await supabase
          .rpc('get_trending_wiki_entries')
          .limit(100);

        if (trendingError) throw trendingError;

        // /rankings의 schemaToggle 필터와 동일하게 schema_type 기준으로 필터
        let filteredData = (trendingEntries || []).filter(
          (e: any) => e.schema_type === (entry.schema_type || 'artist')
        );

        // /rankings와 동일하게 owner_id가 있는 엔트리를 상단으로 올리기 위해 owner_id 조회 후 정렬
        const entryIds = filteredData.map((e: any) => e.id);
        if (entryIds.length > 0) {
          const { data: ownerData } = await supabase
            .from('wiki_entries')
            .select('id, owner_id')
            .in('id', entryIds);

          const ownerMap = new Map((ownerData || []).map((o: any) => [o.id, o.owner_id]));

          filteredData = filteredData
            .map((e: any) => ({ ...e, owner_id: ownerMap.get(e.id) || null }))
            .sort((a: any, b: any) => {
              const aHasOwner = !!a.owner_id;
              const bHasOwner = !!b.owner_id;
              if (aHasOwner && !bHasOwner) return -1;
              if (!aHasOwner && bHasOwner) return 1;
              return (b.trending_score || 0) - (a.trending_score || 0);
            });
        }

        // /rankings와 동일하게 리스트 index 기반으로 랭킹 계산
        const rankIndex = filteredData.findIndex((e: any) => e.id === entry.id);
        const rank = rankIndex + 1;
        entry.current_rank = rank > 0 ? rank : '?';

        // /rankings 페이지 표시값과 동일하게 trending_score도 RPC 값으로 동기화
        const matched = filteredData.find((e: any) => e.id === entry.id);
        if (matched?.trending_score != null) entry.trending_score = matched.trending_score;

        // 다음 랭킹(상위) 엔트리의 점수 계산
        if (rankIndex > 0) {
          const nextRankEntry = filteredData[rankIndex - 1];
          entry.next_rank_score = nextRankEntry?.trending_score || 0;
        } else {
          entry.next_rank_score = entry.trending_score; // 이미 1위인 경우
        }
      }
      
      return data;
    },
    refetchInterval: 30000,
  });

  // 이벤트 기간 전체 투표 합계 조회 (special_votes 테이블에서 직접 조회)
  const { data: totalVotes = 0 } = useQuery({
    queryKey: ['event-votes', activeEvent?.id],
    queryFn: async () => {
      if (!activeEvent?.id) return 0;
      
      const { data, error } = await supabase
        .from('special_votes')
        .select('vote_count')
        .eq('event_id', activeEvent.id);

      if (error) throw error;
      // 모든 투표의 절대값 합계 (업보트/다운보트 모두 포함)
      return data?.reduce((sum, v) => sum + Math.abs(v.vote_count), 0) || 0;
    },
    enabled: !!activeEvent?.id,
    refetchInterval: 10000, // 10초마다 확인
  });

  // 사용자의 투표 현황
  const { data: userVoteStatus } = useQuery({
    queryKey: ['special-event-user-votes', activeEvent?.id, user?.id, fingerprint, isAdmin],
    queryFn: async () => {
      if (!activeEvent?.id) return { voted: false, totalVotes: 0, maxVotes: 13, isUnlimited: false };
      
      // 로그인 사용자
      if (user?.id) {
        const { data, error } = await supabase
          .from('special_votes')
          .select('vote_count')
          .eq('event_id', activeEvent.id)
          .eq('user_id', user.id);

        if (error) throw error;
        // 사용한 투표수는 절대값의 합으로 계산 (업보트/다운보트 모두 에너지 소모)
        const totalUsedVotes = data?.reduce((sum, v) => sum + Math.abs(v.vote_count), 0) || 0;
        return { voted: totalUsedVotes > 0, totalVotes: totalUsedVotes, maxVotes: 13, isUnlimited: false };
      }
      
      // 비로그인 사용자 (핑거프린트로 체크)
      if (fingerprint) {
        const { data, error } = await supabase
          .from('special_votes')
          .select('vote_count')
          .eq('event_id', activeEvent.id)
          .eq('fingerprint', fingerprint)
          .is('user_id', null);

        if (error) throw error;
        const totalUsedVotes = data?.reduce((sum, v) => sum + Math.abs(v.vote_count), 0) || 0;
        return { voted: totalUsedVotes > 0, totalVotes: totalUsedVotes, maxVotes: 1, isUnlimited: false };
      }

      return { voted: false, totalVotes: 0, maxVotes: 1, isUnlimited: false };
    },
    enabled: !!activeEvent?.id && (!!user?.id || !!fingerprint),
  });

  // 온체인 기록 진행 중 플래그 (연속 투표 시 스킵)
  const [isOnchainPending, setIsOnchainPending] = useState(false);
  // 마지막 온체인 기록 시간 (쓰로틀링용)
  const lastOnchainRecordRef = useRef<number>(0);
  const ONCHAIN_THROTTLE_MS = 5000; // 5초 간격

  // 투표 처리
  const handleVote = async (isUpvote: boolean = true) => {
    if (!activeEvent?.id) return;
    
    const usedVotes = Math.abs(userVoteStatus?.totalVotes || 0);
    const maxVotes = userVoteStatus?.maxVotes || (user ? 13 : 1);
    const adminUnlimited = isAdmin; // 관리자는 무제한
    const remainingVotes = adminUnlimited ? Infinity : (maxVotes - usedVotes);
    
    if (!adminUnlimited && remainingVotes <= 0) {
      toast.error(user ? "You've used all 13 votes!" : "Please login to vote more!");
      return;
    }

    const actualVoteAmount = adminUnlimited ? voteAmount : Math.min(voteAmount, remainingVotes);
    const voteValue = isUpvote ? actualVoteAmount : -actualVoteAmount;
    
    setIsVoting(true);
    setVoteAnimation(isUpvote ? 'up' : 'down');
    setTimeout(() => setVoteAnimation(null), 500);
    
    // 이미지 중앙 투표 애니메이션
    setShowVoteAnimation(isUpvote ? 'up' : 'down');
    setTimeout(() => setShowVoteAnimation(null), 1000);
    try {
      // 1. special_votes에 투표 기록
      const { data: insertedVote, error } = await supabase
        .from('special_votes')
        .insert({
          event_id: activeEvent.id,
          user_id: user?.id || null,
          vote_count: voteValue,
          fingerprint: user?.id ? null : fingerprint,
        })
        .select('id')
        .single();

      if (error) throw error;

      // 2. wiki_entries의 votes + vote_delta, trending_score + vote_delta (RPC 함수 사용)
      // RPC 함수가 트리거 가중치를 보정해서 점수가 vote_delta만큼만 반영되도록 처리
      const wikiEntryId = (activeEvent.wiki_entries as any)?.id;
      const artistName = (activeEvent.wiki_entries as any)?.title || 'Unknown';
      if (wikiEntryId) {
        await supabase.rpc('increment_event_vote', {
          entry_id_param: wikiEntryId,
          vote_delta: voteValue
        });
      }

      // 3. 온체인 기록 (비동기 - 쓰로틀링 적용)
      // 관리자 투표는 온체인 기록 스킵
      const now = Date.now();
      // 온체인 기록은 5초 단위로만 수행 (번들러 unstaked 한도 보호)
      const canRecordOnchain = (now - lastOnchainRecordRef.current) > ONCHAIN_THROTTLE_MS;
      
      const voteType = isUpvote ? 'Upvoted' : 'Downvoted';
      
      if (user?.id && !isAdmin && canRecordOnchain) {
        // 로그인 사용자만 온체인 기록 (지갑 필요)
        lastOnchainRecordRef.current = now;

        // UI는 1초 정도만 “Recording…” 표시 (실제 온체인 확정 대기는 백그라운드)
        setIsOnchainPending(true);
        setTimeout(() => setIsOnchainPending(false), 1100);

        toast.success(
          `${voteType} ${actualVoteAmount} point${actualVoteAmount > 1 ? 's' : ''}! Recording on-chain…`,
          { duration: 1100 }
        );

        // 1초 후 백그라운드에서 온체인 기록 시작
        setTimeout(() => {
          supabase.functions.invoke('record-onchain-vote', {
            body: {
              eventId: insertedVote?.id,
              voterAddressOrUserId: user.id,
              artistName,
              inviteCode: '',
              voteCount: Math.abs(voteValue),
            }
          }).then(({ data, error: onchainError }) => {
            if (onchainError) {
              console.error('Onchain vote recording failed:', onchainError);
            } else if (data?.success) {
              console.log('Onchain vote recorded:', data.txHash);
              window.dispatchEvent(new CustomEvent('onchainTxUpdated'));
            }
          }).catch(err => {
            console.error('Onchain vote recording error:', err);
          });
        }, 1000);
      } else {
        toast.success(`${voteType} ${actualVoteAmount} point${actualVoteAmount > 1 ? 's' : ''}!`);
        if (user?.id && !isAdmin) {
          console.log('Skipping onchain record due to throttling');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['special-event-votes'] });
      queryClient.invalidateQueries({ queryKey: ['special-event-user-votes'] });
      queryClient.invalidateQueries({ queryKey: ['special-event-active'] }); // 점수 갱신을 위해 추가
      setVoteAmount(1);
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  // 잠금 해제 애니메이션 트리거 (조건부 return 전에 위치해야 함)
  useEffect(() => {
    const pageStatus = (activeEvent?.wiki_entries as any)?.page_status;
    const entryVotes = (activeEvent?.wiki_entries as any)?.votes || 0;
    
    // page_status가 claimed/verified로 변경되었을 때 애니메이션
    if (pageStatus && prevPageStatus !== null) {
      const wasLocked = prevPageStatus !== 'claimed' && prevPageStatus !== 'verified';
      const nowUnlocked = pageStatus === 'claimed' || pageStatus === 'verified';
      
      if (wasLocked && nowUnlocked) {
        setShowUnlockAnimation(true);
        setTimeout(() => setShowUnlockAnimation(false), 2000);
      }
    }
    
    // votes가 1000에 도달했을 때 애니메이션
    if (prevAggregatedVotes !== null && prevAggregatedVotes < 1000 && entryVotes >= 1000) {
      setShowUnlockAnimation(true);
      setTimeout(() => setShowUnlockAnimation(false), 2000);
    }
    
    if (pageStatus) {
      setPrevPageStatus(pageStatus);
    }
    setPrevAggregatedVotes(entryVotes);
  }, [activeEvent, prevPageStatus, prevAggregatedVotes]);

  const usedVotes = Math.abs(userVoteStatus?.totalVotes || 0);
  const maxVotes = userVoteStatus?.maxVotes || (user ? 13 : 1);
  const isUnlimited = isAdmin; // 관리자는 무제한
  const remainingVotes = isUnlimited ? Infinity : (maxVotes - usedVotes);
  const canVote = isUnlimited || remainingVotes > 0;

  if (eventLoading) {
    return (
      <V2Layout pcHeaderTitle="Special Event" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16' : ''} py-8`}>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        </div>
      </V2Layout>
    );
  }

  if (!activeEvent) {
    // 24h rush가 없을 때: /challenges 페이지로 리다이렉트
    return <Navigate to="/challenges" replace />;
  }

  const wikiEntry = activeEvent.wiki_entries as any;
  const endTime = new Date(activeEvent.end_time);
  
  // 잠금 해제 상태 확인 (claimed/verified이거나 votes >= 1000인 경우)
  const isUnlocked = wikiEntry?.page_status === 'claimed' || wikiEntry?.page_status === 'verified' || (wikiEntry?.votes || 0) >= 1000;

  return (
    <>
      {/* 잠금 해제 애니메이션 - 화면 중앙 */}
      {showUnlockAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* 중앙 응원봉 */}
            <div className="animate-[explode_0.8s_ease-out_forwards]">
              <Wand2 className="h-24 w-24 text-primary drop-shadow-2xl" />
            </div>
            {/* 폭발 파티클 효과 */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full bg-primary animate-[particle_1s_ease-out_forwards]"
                style={{
                  '--angle': `${i * 30}deg`,
                  transform: `translate(-50%, -50%) rotate(var(--angle)) translateY(0)`,
                  animationDelay: `${i * 0.05}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      )}
      
      <Helmet>
        <title>{`Special Event: ${wikiEntry?.title} | KTrendz`}</title>
        <meta name="description" content={`Vote for ${wikiEntry?.title} in this special 24-hour event!`} />
      </Helmet>
      
      <V2Layout pcHeaderTitle={`${wikiEntry?.title} 24h Rush`} showBackButton={true}>
        <div className={`${isMobile ? 'pt-16' : ''} py-4 max-w-2xl mx-auto px-0 sm:px-4`}>
          {/* 타이틀 - 상단 중앙 */}
          <h1 className="text-xl sm:text-2xl font-bold text-center mb-2 px-4 sm:px-0 leading-tight">
            <span className="sm:hidden">Reach 1000 Votes &<br /></span>
            <span className="hidden sm:inline">Reach 1000 Votes & </span>
          Start Supporting{' '}
          <Link 
            to={`/k/${wikiEntry?.slug}`} 
            className="text-primary hover:underline"
          >
            {wikiEntry?.title}
          </Link>
          !
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-4 px-4 sm:px-0">Boost the ranking with 24-hour special voting!</p>

        {/* 플립 카운터 - 타이틀 아래 */}
        <div className="flex justify-center my-14">
          <FlipCountdown targetTime={endTime} />
        </div>

        {/* 아티스트 이미지 카드 - /rankings 스타일 */}
        <div className="flex justify-center mb-6">
          <Link 
            to={`/k/${wikiEntry?.slug}`}
            className="group cursor-pointer flex flex-col bg-card sm:rounded-xl w-full max-w-2xl shadow-lg hover:shadow-xl transition-shadow"
          >
          <div className="relative aspect-[3/4] sm:aspect-[3/2] sm:rounded-t-xl overflow-hidden bg-muted">
              {wikiEntry?.image_url ? (
                <img 
                  src={wikiEntry.image_url} 
                  alt={wikiEntry?.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <User className="w-20 h-20" />
                </div>
              )}
              
              {/* 업보트/다운보트 애니메이션 - 이미지 중앙 */}
              {showVoteAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="relative">
                    {/* 중앙 아이콘 */}
                    <div className="animate-[vote-burst_0.8s_ease-out_forwards]">
                      {showVoteAnimation === 'up' ? (
                        <ThumbsUp className="h-24 w-24 text-white drop-shadow-2xl" />
                      ) : (
                        <ThumbsDown className="h-24 w-24 text-destructive drop-shadow-2xl" />
                      )}
                    </div>
                    {/* 파티클 효과 */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{
                          animation: `particle 0.8s ease-out forwards`,
                          animationDelay: `${i * 0.05}s`,
                          transform: `rotate(${i * 45}deg)`,
                        }}
                      >
                        <div 
                          className={`w-3 h-3 rounded-full ${showVoteAnimation === 'up' ? 'bg-primary' : 'bg-destructive'}`}
                          style={{
                            boxShadow: showVoteAnimation === 'up' 
                              ? '0 0 10px hsl(var(--primary))' 
                              : '0 0 10px hsl(var(--destructive))'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 잠금/해제 상태 아이콘 및 투표수 - 좌상단 */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                {isUnlocked ? (
                  <div className="w-10 h-10 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Wand2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                  {(wikiEntry?.votes || 0).toLocaleString()} / 1,000
                </span>
              </div>
              
              {/* 랭킹 배지 제거됨 - 혼동 방지 */}
              
              {/* 투표 버튼 및 Progress - 이미지 하단 오버레이 */}
              <div 
                className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-4 pt-20"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
                onClick={(e) => e.preventDefault()}
              >
                {/* Progress to 1,000 Votes */}
                {(() => {
                  const currentVotes = wikiEntry?.votes || 0;
                  const targetVotes = 1000;
                  const remainingVotes = Math.max(0, targetVotes - currentVotes);
                  const progressPercent = Math.min((currentVotes / targetVotes) * 100, 100);
                  const isComplete = currentVotes >= targetVotes;
                  
                  return (
                    <div className="w-full max-w-xs px-4 mb-4">
                      <div className="flex items-center justify-center mb-2">
                        {isComplete ? (
                          <span className="text-xs font-medium text-white/90 flex items-center gap-1">
                            <Wand2 className="h-4 w-4" />
                            Lightstick Unlocked!
                          </span>
                        ) : (
                          <span className="text-white/90">
                            <span className="text-lg font-bold text-white">{remainingVotes.toLocaleString()} Votes</span>
                            <span className="text-xs font-medium ml-1">to lightstick support</span>
                          </span>
                        )}
                      </div>
                      <div className="relative h-3 rounded-full overflow-hidden bg-white/20">
                        <div 
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 animate-rainbow-flow"
                          style={{
                            width: `${progressPercent}%`,
                            background: 'linear-gradient(90deg, hsl(340, 82%, 52%), hsl(291, 64%, 42%), hsl(262, 83%, 58%), hsl(217, 91%, 60%), hsl(189, 94%, 43%), hsl(340, 82%, 52%))',
                            backgroundSize: '200% 100%'
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 투표 버튼 */}
                {canVote ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* 온체인 기록 중 메시지 */}
                    {isOnchainPending && (
                      <div className="flex items-center gap-2 bg-primary/20 backdrop-blur-sm px-4 py-2 rounded-full">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium text-white">Recording your vote on Base blockchain...</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-6">
                      <Button
                        size="lg"
                        className="h-20 w-20 rounded-full overflow-visible shadow-xl bg-primary/90 hover:bg-primary backdrop-blur-sm"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote(true); }}
                        disabled={isVoting}
                      >
                        {isOnchainPending ? (
                          <Loader2 className="h-10 w-10 animate-spin" />
                        ) : (
                          <ThumbsUp 
                            className={`h-10 w-10 transition-transform ${
                              voteAnimation === 'up' 
                                ? 'animate-[explode_0.5s_ease-out]' 
                                : ''
                            }`} 
                          />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-20 w-20 rounded-full overflow-visible shadow-xl bg-background/80 hover:bg-destructive/20 hover:border-destructive hover:text-destructive backdrop-blur-sm"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote(false); }}
                        disabled={isVoting}
                      >
                        {isOnchainPending ? (
                          <Loader2 className="h-10 w-10 animate-spin" />
                        ) : (
                          <ThumbsDown 
                            className={`h-10 w-10 transition-transform ${
                              voteAnimation === 'down' 
                                ? 'animate-[explode_0.5s_ease-out]' 
                                : ''
                            }`} 
                          />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-background/80 backdrop-blur-sm rounded-xl px-6">
                    <p className="text-foreground font-medium mb-2">
                      {user ? "You've used all your votes!" : "You've used your vote!"}
                    </p>
                    {!user && (
                      <Link to="/auth" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" className="gap-2">
                          <Zap className="h-4 w-4" />
                          Login for 13 more votes
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 flex flex-col">
              <h3 className="font-semibold text-2xl line-clamp-1 text-center">
                {wikiEntry?.title}
              </h3>
              <div className="w-full h-px bg-border/30 my-4" />
              {/* Votes, Score 정보 - Rank 제거 */}
              <div className="flex justify-center gap-8">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">Total Votes</span>
                  <span className="text-lg font-bold text-primary flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    {(wikiEntry?.votes || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">Event Votes</span>
                  <span className="text-lg font-bold text-primary flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    {totalVotes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>


        {/* Voting energy 표시 */}
        <div className="text-center px-4">
          <p className="text-sm text-muted-foreground">
            My daily voting energy : <span className="font-semibold text-primary">
              {isUnlimited ? `${usedVotes} / ∞` : `${usedVotes}/${maxVotes}`}
            </span>
            {isUnlimited && <span className="ml-2 text-xs text-primary">(Admin)</span>}
          </p>
          {!user && (
            <p className="text-xs text-muted-foreground mt-2">
              <Link to="/auth" className="text-primary hover:underline">Login</Link> to get 13 votes instead of 1!
            </p>
          )}
        </div>

        {/* What's Next Section */}
        <section className="w-full max-w-md mx-auto px-4 py-8">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 mb-6 group">
              <h2 className="text-xl font-bold">What's Next? 🚀</h2>
              <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=closed]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-card/50 border border-border/50">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">1,000 Votes Goal</h3>
                <p className="text-sm text-muted-foreground">Reach the milestone together as a fandom!</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-card/50 border border-border/50">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl">🪄</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Lightstick Created</h3>
                <p className="text-sm text-muted-foreground">Your exclusive fan token is issued!</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-card/50 border border-border/50">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl">💝</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Support Begins</h3>
                <p className="text-sm text-muted-foreground">
                  Fans decide how to support — fully transparent & community-driven!
                </p>
              </div>
            </div>

            {/* Join Button */}
            <div className="mt-8 text-center">
              {user ? (
                <Link to="/">
                  <Button className="rounded-full px-8 gap-2">
                    <Sparkles className="h-4 w-4" />
                    Explore K-Trendz
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button className="rounded-full px-8 gap-2">
                    <Zap className="h-4 w-4" />
                    Join K-Trendz
                  </Button>
                </Link>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
      </div>
    </V2Layout>
      
      <SignupCtaBanner 
        buttonText="Start Now"
        redirectPath="/special-event"
        title="Join the Rush!"
        subtitle="Vote for your favorite & win rewards"
      />
    </>
  );
};

export default SpecialEvent;