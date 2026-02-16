import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Trophy, Users, DollarSign, CheckCircle2, Calendar, ChevronDown, Award, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface WikiEntryBasic {
  id: string;
  title: string;
  image_url: string | null;
  slug?: string;
}

interface ChallengeOptions {
  type?: string;
  youtube_initial_views?: number;
  youtube_initial_likes?: number;
  youtube_initial_comments?: number;
  youtube_fetched_at?: string;
  youtube_url?: string;
  youtube_video_id?: string;
  [key: string]: any;
}

interface PastChallenge {
  id: string;
  question: string;
  total_prize_usdc: number;
  winner_count: number;
  end_time: string;
  correct_answer?: string;
  selected_at?: string;
  image_url?: string | null;
  options?: ChallengeOptions | null;
  wiki_entry?: {
    id: string;
    title: string;
    image_url: string | null;
    slug: string;
  } | null;
  wiki_entries?: WikiEntryBasic[];
}

interface Winner {
  id: string;
  user_id: string;
  prize_amount: number | null;
  has_lightstick: boolean;
  answer: string;
  profile: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface PastChallengeCardProps {
  challenge: PastChallenge;
}

export function PastChallengeCard({ challenge }: PastChallengeCardProps) {
  const { user } = useAuth();
  const [participantCount, setParticipantCount] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);
  const [userParticipation, setUserParticipation] = useState<{
    answer: string;
    is_winner: boolean;
    prize_amount: number | null;
  } | null>(null);

  const endDate = new Date(challenge.end_time);
  const isEnded = endDate <= new Date();
  const challengeOptions = challenge.options as ChallengeOptions | null;
  const isMultipleChoice = challengeOptions?.type === 'multiple_choice';
  // 객관식: end_time 지나면 정답 공개, 그 외: selected_at 또는 correct_answer 있으면 공개
  const isResultRevealed = isMultipleChoice 
    ? (isEnded && !!challenge.correct_answer) 
    : (!!challenge.selected_at || !!challenge.correct_answer);

  // YouTube URL에서 video ID 추출
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // YouTube 썸네일 URL 생성
  const getYouTubeThumbnail = (videoId: string): string => {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  // 히어로 이미지 결정: image_url > YouTube 썸네일 > wiki_entry 이미지
  const getHeroImage = (): string | null => {
    // 1. 직접 설정된 image_url
    if (challenge.image_url && !challenge.image_url.includes('youtube.com') && !challenge.image_url.includes('youtu.be')) {
      return challenge.image_url;
    }
    
    // 2. YouTube URL에서 썸네일 추출
    const youtubeUrl = challenge.options?.youtube_url || challenge.options?.youtube_video_id || challenge.image_url;
    if (youtubeUrl) {
      const videoId = challenge.options?.youtube_video_id || getYouTubeVideoId(youtubeUrl);
      if (videoId) {
        return getYouTubeThumbnail(videoId);
      }
    }
    
    // 3. wiki_entry 이미지
    if (challenge.wiki_entry?.image_url) {
      return challenge.wiki_entry.image_url;
    }
    
    // 4. wiki_entries 첫 번째 이미지
    if (challenge.wiki_entries && challenge.wiki_entries.length > 0 && challenge.wiki_entries[0].image_url) {
      return challenge.wiki_entries[0].image_url;
    }
    
    return null;
  };

  const heroImage = getHeroImage();

  useEffect(() => {
    fetchStats();
    if (user) {
      checkUserParticipation();
    }
  }, [challenge.id, user]);

  const fetchStats = async () => {
    // 참가자 수
    const { count } = await supabase
      .from('challenge_participations')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id);
    
    setParticipantCount(count || 0);
  };

  const checkUserParticipation = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('challenge_participations')
      .select('answer, is_winner, prize_amount')
      .eq('challenge_id', challenge.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      setUserParticipation(data[0]);
    }
  };

  const fetchWinners = async () => {
    setIsLoadingWinners(true);
    try {
      const { data } = await supabase
        .from('challenge_participations')
        .select('id, user_id, prize_amount, has_lightstick, answer')
        .eq('challenge_id', challenge.id)
        .eq('is_winner', true)
        .order('prize_amount', { ascending: false });
      
      if (data && data.length > 0) {
        const userIds = data.map(w => w.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        setWinners(data.map(w => ({
          ...w,
          profile: profilesMap.get(w.user_id) || null,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch winners:', err);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  return (
    <Card className="overflow-hidden bg-white/10 backdrop-blur-sm md:backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:bg-white/15 transition-all duration-300 content-visibility-auto">
      <div className="flex flex-col sm:flex-row">
        {/* 상단/좌측 이미지 - 더 크게 */}
        <div className="relative w-full sm:w-40 md:w-48 h-32 sm:h-auto shrink-0">
          {heroImage ? (
            <img 
              src={heroImage} 
              alt="Challenge" 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-90"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500/30 via-indigo-500/30 to-blue-500/30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30 hidden sm:block" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:hidden" />
          
          {/* 상태 뱃지 - 글래스모피즘 */}
          <div className="absolute top-2 left-2">
            {isResultRevealed ? (
              <Badge className="bg-green-500/30 backdrop-blur-xl text-white text-[9px] px-1.5 py-0.5 border border-green-400/30">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                Done
              </Badge>
            ) : (
              <Badge className="bg-white/20 backdrop-blur-xl text-white text-[9px] px-1.5 py-0.5 border border-white/20">
                Ended
              </Badge>
            )}
          </div>

          {/* 초기 조회수 표시 (YouTube 챌린지인 경우) - 글래스모피즘 */}
          {challenge.options?.youtube_initial_views && (
            <div className="absolute bottom-2 left-2 right-2 sm:right-auto">
              <Badge className="bg-white/10 backdrop-blur-xl text-white text-[9px] px-1.5 py-0.5 border border-white/20">
                <Eye className="h-2.5 w-2.5 mr-1" />
                Start: {challenge.options.youtube_initial_views.toLocaleString()}
                {challenge.options.youtube_fetched_at && (
                  <span className="ml-1 text-white/60">
                    ({format(new Date(challenge.options.youtube_fetched_at), 'MMM d, HH:mm')})
                  </span>
                )}
              </Badge>
            </div>
          )}
        </div>

        {/* 우측 콘텐츠 */}
        <CardContent className="flex-1 p-3 space-y-2">
          {/* 질문 */}
          <p className="text-sm font-bold text-white leading-tight">
            {challenge.question}
          </p>

          {/* 통계 - 글래스 스타일 */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span className="flex items-center gap-1 text-white/60">
              <Calendar className="h-3 w-3" />
              {format(endDate, 'MMM d')}
            </span>
            <span className="flex items-center gap-1 text-white/60">
              <Users className="h-3 w-3" />
              {participantCount}
            </span>
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <DollarSign className="h-3 w-3" />
              {challenge.total_prize_usdc}
            </span>
          </div>

          {/* 정답 또는 내 참여 결과 - 글래스모피즘 */}
          {isResultRevealed && challenge.correct_answer ? (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-green-500/20 backdrop-blur-sm border border-green-400/30">
              <CheckCircle2 className="h-4 w-4 text-green-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-green-300/70 block">Answer</span>
                <span className="text-sm text-green-200 font-bold truncate block">{challenge.correct_answer}</span>
              </div>
            </div>
          ) : userParticipation ? (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-white/50">Your answer:</span>
              <span className="text-white/80 truncate">{userParticipation.answer}</span>
              {userParticipation.is_winner && (
                <Badge className="bg-amber-500/30 backdrop-blur-sm text-amber-200 text-[9px] px-1 py-0 border border-amber-400/30">
                  <Trophy className="h-2.5 w-2.5 mr-0.5" />
                  Won
                </Badge>
              )}
            </div>
          ) : null}

          {/* 당첨자 보기 버튼 - 글래스모피즘 */}
          <Dialog onOpenChange={(open) => open && fetchWinners()}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[11px] bg-white/10 backdrop-blur-xl border-white/20 text-amber-300 hover:bg-white/20 hover:text-amber-200 transition-all duration-300"
              >
                <Award className="h-3 w-3 mr-1" />
                {isResultRevealed ? `${winners.length > 0 ? winners.length : challenge.winner_count} Winners` : 'Winners'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden p-0 [&>button]:hidden">
              {/* 캐쥬얼 그라데이션 헤더 */}
              <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-white">
                <DialogClose asChild>
                  <button className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                    <span className="sr-only">Close</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </DialogClose>
                <div className="flex items-center gap-3">
                  <div className="text-4xl">🏆</div>
                  <div>
                    <h3 className="text-lg font-bold">Challenge Winners</h3>
                    <p className="text-sm text-white/80">Congratulations to all winners! 🎉</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[55vh] space-y-2">
                {isLoadingWinners ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  </div>
                ) : winners.length > 0 ? (
                  winners.map((winner, idx) => (
                    <div 
                      key={winner.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-bold shadow-md">
                        {idx + 1}
                      </div>
                      <Avatar className="h-9 w-9 border-2 border-amber-300/50">
                        <AvatarImage src={winner.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold">
                          {winner.profile?.username?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">
                          @{winner.profile?.username || 'Anonymous'}
                        </p>
                        <p className="text-xs text-amber-700/70 dark:text-amber-300/60 truncate">{winner.answer}</p>
                      </div>
                      {winner.has_lightstick && (
                        <span className="text-lg shrink-0" title="Lightstick Holder">🪄</span>
                      )}
                      {winner.prize_amount && (
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 shadow-sm">
                          ${winner.prize_amount}
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-3">🎯</div>
                    <p className="text-muted-foreground">No winners yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Winners will be announced soon!</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </div>
    </Card>
  );
}
