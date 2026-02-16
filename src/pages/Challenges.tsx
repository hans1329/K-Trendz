import { Helmet } from "react-helmet-async";
import SignupCtaBanner from "@/components/SignupCtaBanner";
import TranslationBanner from "@/components/TranslationBanner";
import { usePageTranslation } from "@/hooks/usePageTranslation";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Loader2, DollarSign, Users, Link2, History, ChevronLeft, ChevronRight, HelpCircle, Share2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChallengeCard } from "@/components/ChallengeCard";
import { PastChallengeCard } from "@/components/PastChallengeCard";
import { FlipCountdown } from "@/components/FlipCountdown";
import { format } from "date-fns";
import { ethers } from "ethers";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";


const Challenges = () => {
  const { challengeId } = useParams<{ challengeId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [carouselHeight, setCarouselHeight] = useState<number>();
  const [selectedActiveIndex, setSelectedActiveIndex] = useState(0);
  const carouselResizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasScrolledToChallenge = useRef(false);

  // 번역 훅
  const {
    isTranslating, isTranslated, isTranslatableLanguage,
    languageName, showOriginal, toggleOriginal, t,
  } = usePageTranslation({
    cacheKey: 'challenges-page',
    segments: {
      'expert_challenges': 'K-POP Expert Challenges',
      'submission_deadline': '⏰ Submission Deadline',
      'starts_in': '🚀 Starts in',
      'total_prize': 'Total Prize',
      'prize_pool': 'Prize Pool',
      'view_contract': 'View Contract',
      'winners': 'WINNERS',
      'rank': 'Rank',
      'with_lightstick': 'With Lightstick',
      'without': 'Without',
      'rules': 'rules',
      'winner_selection_logic': 'Winner Selection Logic',
      'ratio_desc': '70% of winners are selected from Lightstick holders, 30% from non-holders.',
      'selection_desc': 'For view predictions, closest answers win. For quizzes, correct answers are randomly selected.',
      'onchain_desc': 'Winner selection uses blockchain randomness for transparency.',
      'tip': '💡 Tip: Hold a Lightstick to increase your winning chances!',
      'active': 'Active',
      'past': 'Past',
      'no_active': 'No Active Challenges',
      'check_back': 'Check back later for prediction challenges!',
      'go_to_rankings': 'Go to Rankings',
      'no_past': 'No Past Challenges',
      'completed_appear': 'Completed challenges will appear here.',
      'ready_to_win': 'Ready to Win?',
      'join_challenge': 'Join the challenge and win USDC prizes!',
      'start_now': 'Start Now',
      'powered_by': 'Powered by',
    },
  });

  // 활성 챌린지 조회
  // Active 조건: (status in ('active','ended','approved')) AND (결과 발표 시점 + 24h > now)
  const { data: activeChallenges = [], isLoading } = useQuery({
    queryKey: ['active-challenges-page'],
    queryFn: async () => {
      const now = new Date();
      
      // 관리자 여부 확인
      const { data: { user } } = await supabase.auth.getUser();
      let isAdmin = false;
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleData;
      }
      
      // 관리자는 test status도 포함
      const statusFilter = isAdmin 
        ? ['active', 'ended', 'approved', 'test'] 
        : ['active', 'ended', 'approved'];
      
      // 1. 챌린지 조회
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          wiki_entry:wiki_entries(id, title, image_url, slug)
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const isActiveWindow = (c: any) => {
        if (c.status === 'cancelled') return false;
        if (c.status === 'test') return true;
        const baseTime = c.selected_at || c.answer_fetch_time;
        if (!baseTime) return true;
        const baseDate = new Date(baseTime);
        if (Number.isNaN(baseDate.getTime())) return true;
        const cutoff = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
        return now < cutoff;
      };
      
      const filtered = (data || []).filter(isActiveWindow);
      if (filtered.length === 0) return [];
      
      // 2. N+1 제거: 모든 관련 wiki_entries를 한 번에 조회
      const challengeIds = filtered.map(c => c.id);
      const { data: allWikiLinks } = await supabase
        .from('challenge_wiki_entries' as any)
        .select('challenge_id, wiki_entry_id, wiki_entries(id, title, image_url, slug)')
        .in('challenge_id', challengeIds);
      
      // challenge_id별로 그룹핑
      const wikiEntriesMap = new Map<string, any[]>();
      (allWikiLinks || []).forEach((link: any) => {
        if (!link.wiki_entries) return;
        const existing = wikiEntriesMap.get(link.challenge_id) || [];
        existing.push(link.wiki_entries);
        wikiEntriesMap.set(link.challenge_id, existing);
      });
      
      return filtered.map(c => ({
        ...c,
        options: c.options as any,
        wiki_entries: wikiEntriesMap.get(c.id) || [],
      }));
    },
    refetchInterval: 60000, // 30초 → 60초로 늘림
    staleTime: 30000, // 30초간 캐시 유지
  });

  // 종료된 챌린지 조회
  const { data: pastChallenges = [], isLoading: isLoadingPast } = useQuery({
    queryKey: ['past-challenges-page'],
    queryFn: async () => {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          wiki_entry:wiki_entries(id, title, image_url, slug)
        `)
        .order('end_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const isPastWindow = (c: any) => {
        if (c.status === 'cancelled') return true;
        const baseTime = c.selected_at || c.answer_fetch_time;
        if (!baseTime) return false;
        const baseDate = new Date(baseTime);
        if (Number.isNaN(baseDate.getTime())) return false;
        const cutoff = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
        return now >= cutoff;
      };

      const filtered = (data || []).filter(isPastWindow).slice(0, 20);
      if (filtered.length === 0) return [];
      
      // N+1 제거: 모든 관련 wiki_entries를 한 번에 조회
      const challengeIds = filtered.map(c => c.id);
      const { data: allWikiLinks } = await supabase
        .from('challenge_wiki_entries' as any)
        .select('challenge_id, wiki_entry_id, wiki_entries(id, title, image_url, slug)')
        .in('challenge_id', challengeIds);
      
      const wikiEntriesMap = new Map<string, any[]>();
      (allWikiLinks || []).forEach((link: any) => {
        if (!link.wiki_entries) return;
        const existing = wikiEntriesMap.get(link.challenge_id) || [];
        existing.push(link.wiki_entries);
        wikiEntriesMap.set(link.challenge_id, existing);
      });
      
      return filtered.map(c => ({
        ...c,
        options: c.options as any,
        wiki_entries: wikiEntriesMap.get(c.id) || [],
      }));
    },
    refetchInterval: 120000, // 60초 → 2분으로 늘림
    staleTime: 60000, // 1분간 캐시 유지
  });

  const CHALLENGE_CONTRACT = '0xdE5eDb6A6A10F1ae91C4ed33bd640D0667a650Da';
  const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // 컨트랙트 USDC 잔액 조회 (Edge Function 사용 - Alchemy RPC)
  const { data: contractUsdcBalance = 0 } = useQuery({
    queryKey: ['challenge-contract-usdc-balance'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-contract-balance');
        if (error) throw error;
        if (data?.success && data?.data?.usdcBalance) {
          return Number(data.data.usdcBalance);
        }
        return 0;
      } catch (err) {
        console.error('Failed to fetch contract USDC balance:', err);
        return 0;
      }
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const now = new Date();

  // Carousel 높이를 현재 슬라이드에 맞추기 (auto-height)
  useEffect(() => {
    if (!carouselApi) return;

    const updateHeight = () => {
      const engine = carouselApi.internalEngine();
      const selectedIndex = carouselApi.selectedScrollSnap();
      setSelectedActiveIndex(selectedIndex);
      const slides = carouselApi.slideNodes();
      const currentSlide = slides[selectedIndex];
      
      if (currentSlide) {
        // 현재 슬라이드의 실제 높이 측정
        const height = currentSlide.getBoundingClientRect().height;
        setCarouselHeight(height);
      }
    };

    // 초기 높이 설정
    updateHeight();

    // 슬라이드 변경 시 높이 업데이트
    carouselApi.on('select', updateHeight);
    carouselApi.on('reInit', updateHeight);

    // ResizeObserver로 슬라이드 내용 변화 감지
    const slides = carouselApi.slideNodes();
    if (slides.length > 0) {
      carouselResizeObserverRef.current = new ResizeObserver(() => {
        updateHeight();
      });
      slides.forEach(slide => {
        carouselResizeObserverRef.current?.observe(slide);
      });
    }

    return () => {
      carouselApi.off('select', updateHeight);
      carouselApi.off('reInit', updateHeight);
      carouselResizeObserverRef.current?.disconnect();
    };
  }, [carouselApi]);

  // URL에 challengeId가 있으면 해당 챌린지로 스크롤
  useEffect(() => {
    if (!challengeId || !carouselApi || hasScrolledToChallenge.current) return;
    if (activeChallenges.length === 0) return;

    const targetIndex = activeChallenges.findIndex(c => c.id === challengeId);
    
    if (targetIndex >= 0) {
      // Active 탭에서 해당 챌린지로 이동
      setActiveTab('active');
      carouselApi.scrollTo(targetIndex);
      hasScrolledToChallenge.current = true;
      
      // URL에서 challengeId 제거 (clean URL)
      navigate('/challenges', { replace: true });
    } else {
      // Past 챌린지인지 확인
      const isPast = pastChallenges.some(c => c.id === challengeId);
      if (isPast) {
        setActiveTab('past');
        hasScrolledToChallenge.current = true;
        navigate('/challenges', { replace: true });
      }
    }
  }, [challengeId, carouselApi, activeChallenges, pastChallenges, navigate]);

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // 챌린지별 히어로 렌더링 함수
  const renderChallengeHero = (challenge: any, index: number, total: number) => {
    const challengeOptions = (challenge?.options as any) || null;
    const isStarted = new Date(challenge.start_time) <= now;
    const targetTime = isStarted
      ? new Date(challenge.end_time)
      : new Date(challenge.start_time);
    const prizeTiers = challengeOptions?.prize_tiers || [];

    // 질문에서 특정 부분을 볼드 처리하고 시간을 로컬 타임으로 변환하는 함수
    const formatQuestionWithBold = (question: string, answerFetchTime: string | null) => {
      // answer_fetch_time이 있으면 로컬 타임으로 포맷팅
      let processedQuestion = question;
      
      if (answerFetchTime) {
        const localTime = format(new Date(answerFetchTime), "MMM d, yyyy 'at' h:mm a");
        // 기존 날짜/시간 패턴을 로컬 타임으로 대체
        const dateTimeReplacePattern = /on [A-Z][a-z]{2,8} \d{1,2}, \d{4}(?:,| at) \d{1,2}:\d{2} (?:AM|PM)(?: [A-Z]{2,4})?/gi;
        processedQuestion = processedQuestion.replace(dateTimeReplacePattern, `on ${localTime}`);
      }
      
      // "the view count", "the like count", "the comment count" 부분 볼드
      // 날짜/시간 부분 (on Month DD, YYYY at HH:MM AM/PM) 볼드
      const metricPattern = /(the (?:view|like|comment) count)/gi;
      const dateTimePattern = /(on [A-Z][a-z]{2,8} \d{1,2}, \d{4} at \d{1,2}:\d{2} (?:AM|PM))/gi;
      
      let processed = processedQuestion;
      const markers: { placeholder: string; text: string }[] = [];
      
      let matchIndex = 0;
      processed = processed.replace(metricPattern, (match) => {
        const placeholder = `__BOLD_METRIC_${matchIndex}__`;
        markers.push({ placeholder, text: match });
        matchIndex++;
        return placeholder;
      });
      
      processed = processed.replace(dateTimePattern, (match) => {
        const placeholder = `__BOLD_DATE_${matchIndex}__`;
        markers.push({ placeholder, text: match });
        matchIndex++;
        return placeholder;
      });
      
      if (markers.length === 0) {
        return processedQuestion;
      }
      
      const parts: (string | JSX.Element)[] = [];
      let remaining = processed;
      
      markers.forEach(({ placeholder, text }, idx) => {
        const splitIndex = remaining.indexOf(placeholder);
        if (splitIndex > 0) {
          parts.push(remaining.substring(0, splitIndex));
        }
        parts.push(
          <strong
            key={idx}
            className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-200"
          >
            {text}
          </strong>
        );
        remaining = remaining.substring(splitIndex + placeholder.length);
      });
      
      if (remaining) {
        parts.push(remaining);
      }
      
      return <>{parts}</>;
    };

    // 질문 표시 (시작 전/후 모두 전체 보임)
    const renderBlurredTitle = () => {
      return formatQuestionWithBold(challenge.question, challenge.answer_fetch_time);
    };

    return (
      <div className="mb-6 sm:mb-8">
        {/* 상단 뱃지 - 글래스모피즘 */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 blur-md opacity-30 will-change-transform" />
            <Badge className="relative text-xs sm:text-sm px-4 sm:px-6 py-1.5 sm:py-2 bg-white/20 text-white border border-white/30 shadow-xl font-bold tracking-wider">
              <Trophy className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 text-amber-300" />
              {t('expert_challenges')}
              {total > 1 && <span className="ml-2 text-amber-200">#{index + 1}/{total}</span>}
            </Badge>
          </div>
        </div>
        
        {/* 퀴즈쇼 스타일 히어로 섹션 - 글래스모피즘 */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-4 sm:mb-6 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {(() => {
            const youtubeUrl = challengeOptions?.youtube_url || challengeOptions?.youtube_video_id;
            const youtubeVideoId = youtubeUrl ? (
              youtubeUrl.includes('youtu.be/') 
                ? youtubeUrl.split('youtu.be/')[1]?.split('?')[0]
                : youtubeUrl.includes('v=')
                  ? youtubeUrl.split('v=')[1]?.split('&')[0]
                  : youtubeUrl.length === 11 ? youtubeUrl : null
            ) : null;

            if (youtubeVideoId) {
              return (
                <div className="w-full h-56 sm:h-72 md:h-96 relative">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              );
            } else if (challenge?.image_url) {
              return (
                <img 
                  src={challenge.image_url} 
                  alt="Challenge" 
                  className="w-full h-56 sm:h-72 md:h-96 object-cover"
                />
              );
            } else {
              return (
                <div className="w-full h-56 sm:h-72 md:h-96 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900" />
              );
            }
          })()}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-amber-400/20 to-transparent blur-xl will-change-transform" />
          
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-amber-400 text-lg sm:text-2xl">✦</div>
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 text-amber-400 text-lg sm:text-2xl">✦</div>
          <div className="absolute top-12 left-12 sm:top-16 sm:left-20 text-purple-400 text-sm sm:text-lg">✦</div>
          <div className="absolute top-12 right-12 sm:top-16 sm:right-20 text-blue-400 text-sm sm:text-lg">✦</div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <div className="inline-block bg-black/50 rounded-full px-4 py-1.5 mb-2 sm:mb-3 border border-amber-400/30">
              <p className="text-xs sm:text-sm text-amber-300 font-medium tracking-wide">
                🎯 {format(new Date(challenge.start_time), 'MMM d, yyyy h:mm a')} Challenge
              </p>
            </div>
            
            <div className="relative max-w-xl mx-auto">
              <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-amber-500/15 rounded-xl blur-md will-change-transform" />
              <div className="relative bg-black/40 rounded-xl border border-amber-400/30 px-4 sm:px-8 py-4 sm:py-6">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold px-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)] leading-relaxed tracking-wide">
                  {renderBlurredTitle()}
                </h1>
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 text-4xl sm:text-6xl text-amber-400/20 font-black">?</div>
            <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 text-4xl sm:text-6xl text-amber-400/20 font-black">?</div>
          </div>

          {total > 1 && (
            <>
              <button
                className="absolute left-3 bottom-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-30 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/10 border border-white/30 text-white hover:bg-white/20 flex items-center justify-center transition-all duration-200 shadow-lg"
                onClick={() => carouselApi?.scrollPrev()}
                aria-label="Previous challenge"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-3 bottom-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-30 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/10 border border-white/30 text-white hover:bg-white/20 flex items-center justify-center transition-all duration-200 shadow-lg"
                onClick={() => carouselApi?.scrollNext()}
                aria-label="Next challenge"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>

        {/* 카운트다운 - 글래스모피즘 */}
        <div className="flex flex-col items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 border border-white/20">
            <span className="text-xs sm:text-sm font-bold text-white/90 tracking-widest uppercase">
              {isStarted ? t('submission_deadline') : t('starts_in')}
            </span>
          </div>
          <FlipCountdown targetTime={targetTime} isActive={isStarted} />
        </div>

        {/* 상금 정보 - 글래스모피즘 스타일 */}
        <div className="relative w-full px-2 sm:px-0">
          <div className="relative bg-white/10 rounded-2xl sm:rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
            {/* 상단 상금 섹션 */}
            <div className="relative px-4 sm:px-6 py-5 sm:py-6 text-center border-b border-white/10">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent" />
              <div className="relative">
                <div className="text-white/60 text-xs sm:text-sm font-medium tracking-widest uppercase mb-0.5 sm:mb-1">{t('total_prize')}</div>
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 text-4xl sm:text-5xl md:text-6xl font-black text-white">
                  <DollarSign className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-amber-300" />
                  {challenge.total_prize_usdc.toLocaleString()}
                  <span className="text-lg sm:text-2xl md:text-3xl font-bold ml-0.5 sm:ml-1 text-amber-200">USDC</span>
                </div>
                {!challenge.hide_prize_pool && (
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-300">
                      <span>{t('prize_pool')}:</span>
                      <DollarSign className="h-2.5 w-2.5" />
                      <span>{contractUsdcBalance.toLocaleString()} USDC</span>
                    </span>
                    <a
                      href={`https://basescan.org/address/${CHALLENGE_CONTRACT}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[10px] text-white/50 hover:text-white/80 transition-colors"
                    >
                      <Link2 className="h-2.5 w-2.5" />
                      <span>{t('view_contract')}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 티켓 스타일 구분선 - 글래스 */}
            <div className="relative flex items-center h-5 sm:h-6 bg-white/5">
              <div className="absolute left-0 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-full -translate-x-1/2 border border-white/20" />
              <div className="flex-1 border-t-2 border-dashed border-white/20 mx-3 sm:mx-4" />
              <div className="absolute right-0 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-full translate-x-1/2 border border-white/20" />
            </div>

            {/* 위너 수 및 상금 티어 */}
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col items-center justify-center mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-amber-300" />
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white">
                    {challenge.winner_count}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-white/70 tracking-widest uppercase mt-1">
                  {t('winners')}
                </span>
              </div>
                
              {prizeTiers.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                  <div className="flex justify-between items-center px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white/50">
                    <span>{t('rank')}</span>
                    <div className="flex gap-3 sm:gap-4">
                      <span>{t('with_lightstick')}</span>
                      <span>{t('without')}</span>
                    </div>
                  </div>
                  {prizeTiers.map((tier: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`flex justify-between items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-colors ${
                        idx === 0 
                          ? 'bg-amber-500/20' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {idx === 0 && <span className="text-base sm:text-lg">🥇</span>}
                        {idx === 1 && <span className="text-base sm:text-lg">🥈</span>}
                        {idx === 2 && <span className="text-base sm:text-lg">🥉</span>}
                        {idx > 2 && <span className="text-base sm:text-lg">🏅</span>}
                        <span className="text-xs sm:text-sm text-white/80">
                          {getOrdinal(tier.rank)}
                          {tier.count > 1 && <span className="text-amber-300 ml-1">×{tier.count}</span>}
                        </span>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <span className={`font-bold min-w-[50px] text-right ${
                          idx === 0 ? 'text-base sm:text-lg text-amber-200' : 'text-sm sm:text-base text-white/80'
                        }`}>
                          ${tier.amountWithLightstick || tier.amount || 0}
                        </span>
                        <span className={`font-bold min-w-[50px] text-right ${
                          idx === 0 ? 'text-base sm:text-lg text-white/60' : 'text-sm sm:text-base text-white/50'
                        }`}>
                          ${tier.amountWithoutLightstick || Math.floor((tier.amount || 0) / 2)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Rules 링크 - 글래스 스타일 */}
                  <div className="flex justify-end mt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 text-[10px] sm:text-xs text-white/50 hover:text-white/80 transition-colors">
                          <HelpCircle className="h-3 w-3" />
                          <span>{t('rules')}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 sm:w-80 bg-black/90 border-white/20">
                        <div className="space-y-3">
                          <h4 className="font-bold text-amber-200 flex items-center gap-2">
                            <Trophy className="h-4 w-4" />
                            {t('winner_selection_logic')}
                          </h4>
                          <div className="space-y-2 text-xs sm:text-sm text-white/70">
                            <p className="flex items-start gap-2">
                              <span>🪄</span>
                              <span><strong className="text-amber-200">7:3 Ratio:</strong> {t('ratio_desc')}</span>
                            </p>
                            <p className="flex items-start gap-2">
                              <span>🎯</span>
                              <span><strong className="text-amber-200">Selection:</strong> {t('selection_desc')}</span>
                            </p>
                            <p className="flex items-start gap-2">
                              <span>🔗</span>
                              <span><strong className="text-amber-200">On-chain Verification:</strong> {t('onchain_desc')}</span>
                            </p>
                            <p className="mt-3 pt-2 border-t border-white/10 text-amber-300 font-medium">
                            {t('tip')}
                            </p>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ChallengeCard - 히어로 아래 */}
        <div className="mt-6">
          <ChallengeCard challenge={challenge} showOriginal={showOriginal} />
        </div>
      </div>
    );
  };


  // PC: V2Layout 사용, 모바일: 기존 레이아웃
  const pageContent = (
    <div className="min-h-screen relative overflow-hidden">
      {/* 고정 배경 */}
      <div className={`${isMobile ? 'fixed' : 'absolute'} inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 -z-20`} />
      
      {/* 장식 요소 - blur 축소로 성능 최적화 */}
      <div className={`${isMobile ? 'fixed' : 'absolute'} inset-0 overflow-hidden pointer-events-none -z-10`}>
        <div className="absolute -top-40 -right-40 w-[400px] h-[400px] bg-purple-500/25 rounded-full blur-2xl" />
        <div className="absolute top-1/3 -left-20 w-[320px] h-[320px] bg-pink-500/20 rounded-full blur-2xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-amber-500/20 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-[480px] h-[480px] bg-blue-500/15 rounded-full blur-2xl" />
      </div>
      
      <Helmet>
        <title>Challenges | KTrendz</title>
        <meta name="description" content="Participate in K-Pop prediction challenges and win USDC prizes!" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://k-trendz.com/challenges" />
        <meta property="og:title" content="K-Pop Prediction Challenges | KTrendz" />
        <meta property="og:description" content="Predict K-Pop trends and win USDC prizes! Join weekly prediction challenges on KTrendz." />
        <meta property="og:image" content="https://k-trendz.com/images/challenges-og.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="KTrendz" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://k-trendz.com/challenges" />
        <meta name="twitter:title" content="K-Pop Prediction Challenges | KTrendz" />
        <meta name="twitter:description" content="Predict K-Pop trends and win USDC prizes! Join weekly prediction challenges on KTrendz." />
        <meta name="twitter:image" content="https://k-trendz.com/images/challenges-og.jpg" />
      </Helmet>
      
      <main className="container mx-auto px-3 sm:px-4 pt-4 pb-6 sm:pb-8 max-w-2xl relative z-10">
        {/* 번역 배너 제거 - 헤더로 이동 */}
        {/* 탭 네비게이션 - 글래스모피즘 스타일 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'past')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mt-6 mb-4 sm:mb-6 bg-white/10 border border-white/20 rounded-2xl p-1.5 h-auto shadow-lg">
            <TabsTrigger 
              value="active" 
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-white/30 text-white/70 text-sm rounded-xl py-2.5 transition-all duration-300"
            >
              <Trophy className="h-4 w-4 mr-1.5" />
              {t('active')}
              {activeChallenges.length > 0 && (
                <Badge className="ml-1.5 bg-white/20 text-white text-[10px] w-5 h-5 p-0 rounded-full flex items-center justify-center border border-white/30">
                  {activeChallenges.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="past" 
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-white/30 text-white/70 text-sm rounded-xl py-2.5 transition-all duration-300"
            >
              <History className="h-4 w-4 mr-1.5" />
              {t('past')}
              {pastChallenges.length > 0 && (
                <Badge className="ml-1.5 bg-white/20 text-white/80 text-[10px] w-5 h-5 p-0 rounded-full flex items-center justify-center border border-white/20">
                  {pastChallenges.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="flex justify-center items-center h-48 sm:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : activeChallenges.length > 0 ? (
              <>
                <div 
                  className="relative overflow-hidden transition-[height] duration-300 ease-out"
                  style={carouselHeight ? { height: carouselHeight } : undefined}
                >
                  <Carousel className="w-full" opts={{ loop: true }} setApi={setCarouselApi}>
                    <CarouselContent>
                      {activeChallenges.map((challenge, idx) => (
                        <CarouselItem key={challenge.id}>
                          {renderChallengeHero(challenge, idx, activeChallenges.length)}
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
                
                {/* 인디케이터 - 챌린지가 2개 이상일 때만 표시 */}
                {activeChallenges.length > 1 && (
                  <div className="flex justify-center gap-2 mt-2">
                    {activeChallenges.map((_, idx) => (
                      <div 
                        key={idx}
                        className="w-2 h-2 rounded-full bg-amber-500/30"
                      />
                    ))}
                  </div>
                )}
                  
                <div className="flex justify-end items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-amber-200/70 pr-1 mt-2">
                  <span>{t('powered_by')}</span>
                  <a 
                    href="https://base.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 sm:gap-1 hover:text-amber-100 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-full sm:w-4 sm:h-4">
                      <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF"/>
                      <path d="M55.3646 92.5C75.3646 92.5 91.3646 76.5 91.3646 56.5C91.3646 36.5 75.3646 20.5 55.3646 20.5C36.5646 20.5 21.3646 34.7 19.5646 52.9H67.3646V60.1H19.5646C21.3646 78.3 36.5646 92.5 55.3646 92.5Z" fill="white"/>
                    </svg>
                    <span className="font-medium">BASE</span>
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                <Trophy className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-3 sm:mb-4" />
                <h2 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2">{t('no_active')}</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">{t('check_back')}</p>
                <Link to="/rankings">
                  <Button size="sm" className="sm:size-default">{t('go_to_rankings')}</Button>
                </Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {isLoadingPast ? (
              <div className="flex justify-center items-center h-48 sm:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : pastChallenges.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {pastChallenges.map((challenge) => (
                  <PastChallengeCard 
                    key={challenge.id} 
                    challenge={challenge}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
                <History className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-3 sm:mb-4" />
                <h2 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2">{t('no_past')}</h2>
                <p className="text-sm sm:text-base text-muted-foreground">{t('completed_appear')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* USDC 잔액 표시 */}
      {!(activeTab === 'active' && activeChallenges[selectedActiveIndex]?.hide_prize_pool) && (
        <div className="container mx-auto px-3 sm:px-4 max-w-2xl mb-4">
          <div className="flex justify-end items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-bold text-green-500">
              <span>{t('prize_pool')}:</span>
              <DollarSign className="h-3 w-3" />
              <span>{contractUsdcBalance.toLocaleString()} USDC</span>
            </span>
            <a
              href={`https://basescan.org/address/${CHALLENGE_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-amber-200/70 hover:text-amber-100 transition-colors"
            >
              <Link2 className="h-3 w-3" />
              <span>{t('view_contract')}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <V2Layout pcHeaderTitle="Challenges" showBackButton={true} fullWidth={true} headerRight={
      <div className="flex items-center gap-1">
        {isTranslatableLanguage && (
          <button
            onClick={toggleOriginal}
            disabled={isTranslating}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full bg-muted border border-border active:opacity-60"
          >
            {isTranslating ? (
              <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            ) : (
              <span>{!showOriginal ? '🌐' : '🇺🇸'}</span>
            )}
            <span>{!showOriginal ? languageName : 'EN'}</span>
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) {
              navigator.share({ title: 'KTrendz Challenges', url });
            } else {
              navigator.clipboard.writeText(url);
              import('sonner').then(({ toast }) => toast.success('Link copied!'));
            }
          }}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    }>
      {pageContent}
    </V2Layout>
  );
};

export default Challenges;
