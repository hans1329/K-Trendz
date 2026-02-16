import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Trophy, Users, DollarSign, CheckCircle, Loader2, 
  ExternalLink, Youtube, Eye, Clock, Gift, Sparkles, AlertTriangle,
  Calendar, Hash
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Challenge {
  id: string;
  question: string;
  correct_answer: string;
  options: any;
  total_prize_usdc: number;
  winner_count: number;
  prize_with_lightstick: number;
  prize_without_lightstick: number;
  start_time: string;
  end_time: string;
  status: string;
  selected_at: string | null;
  admin_approved_at: string | null;
  claim_start_time: string | null;
  claim_end_time: string | null;
  answer_fetch_time: string | null;
  selection_block_number: number | null;
  selection_block_hash: string | null;
  selection_seed: string | null;
}

// 통합 당첨자 인터페이스 (internal + external)
interface UnifiedWinner {
  id: string; // user_id 또는 external_wallet_id
  user_id?: string;
  external_wallet_id?: string;
  wallet_address?: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rank: number;
  has_lightstick: boolean;
  prize_amount: number;
  answer: string;
  created_at: string;
  source: 'internal' | 'external';
}

interface YouTubeInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  currentViewCount?: number;
  currentLikeCount?: number;
  currentCommentCount?: number;
  fetchedAt?: string;
}

// 당첨자 표시 순서를 source와 무관하게 만들기 위한 공통 정렬/랭킹 유틸
// - prize_amount 높은 순
// - 숫자형(YouTube 등): 정답 근접도순 → 동률이면 제출시간순
// - 객관식(정답 1개): 랜덤 나열
// - 그 외: 제출시간순
type SortMode = 'proximity' | 'random' | 'time';
function normalizeWinnersForDisplay(list: UnifiedWinner[], correctAnswer?: string, sortMode: SortMode = 'time'): UnifiedWinner[] {
  const targetValue = correctAnswer ? Number(correctAnswer) : NaN;
  const useProximity = sortMode === 'proximity' && Number.isFinite(targetValue);
  const useRandom = sortMode === 'random';

  // 랜덤 모드: 같은 티어 내에서 셔플
  if (useRandom) {
    // 티어별로 그룹화 후 각 그룹 내부를 셔플
    const sorted = [...list].sort((a, b) => (b.prize_amount || 0) - (a.prize_amount || 0));
    const groups: UnifiedWinner[][] = [];
    let currentGroup: UnifiedWinner[] = [];
    let currentPrize = -1;
    for (const w of sorted) {
      const prize = w.prize_amount || 0;
      if (prize !== currentPrize) {
        if (currentGroup.length) groups.push(currentGroup);
        currentGroup = [w];
        currentPrize = prize;
      } else {
        currentGroup.push(w);
      }
    }
    if (currentGroup.length) groups.push(currentGroup);
    // Fisher-Yates 셔플
    for (const group of groups) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
    const shuffled = groups.flat();
    return shuffled.map((w, index) => ({ ...w, rank: index + 1 }));
  }

  const sorted = [...list].sort((a, b) => {
    // 1차: 상금 높은 순
    if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
      return (b.prize_amount || 0) - (a.prize_amount || 0);
    }

    // 2차: 숫자형 챌린지면 정답 근접도순
    if (useProximity) {
      const aDiff = Math.abs(Number(a.answer) - targetValue);
      const bDiff = Math.abs(Number(b.answer) - targetValue);
      const aValid = Number.isFinite(aDiff);
      const bValid = Number.isFinite(bDiff);
      if (aValid && bValid && aDiff !== bDiff) return aDiff - bDiff;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
    }

    // 3차: 제출 시간순
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (aTime !== bTime) return aTime - bTime;

    return a.id.localeCompare(b.id);
  });

  return sorted.map((w, index) => ({
    ...w,
    rank: index + 1,
  }));
}

const AdminChallengeReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [winners, setWinners] = useState<UnifiedWinner[]>([]);
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWinners, setLoadingWinners] = useState(false);
  const [isApproving, setIsApproving] = useState(false); // 레거시 호환 (UI 표시용)
  const [onchainStatus, setOnchainStatus] = useState<{
    step: 'idle' | 'revealing' | 'selecting' | 'distributing';
    txHash?: string;
    error?: string;
    success?: boolean;
  }>({ step: 'idle' });
  const [participantCount, setParticipantCount] = useState(0);
  const [previewWinners, setPreviewWinners] = useState<UnifiedWinner[]>([]);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<Set<string>>(new Set());
  const [isPreviewingWinners, setIsPreviewingWinners] = useState(false);
  const [isSelectingWinners, setIsSelectingWinners] = useState(false);
  const [previewVerification, setPreviewVerification] = useState<any>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [excludedWinnerIds, setExcludedWinnerIds] = useState<Set<string>>(new Set());
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isRetryingOnchain, setIsRetryingOnchain] = useState(false);

  // 권한 체크는 /admin 페이지에서 이미 처리됨


  // 챌린지 데이터 로드
  useEffect(() => {
    if (!id || authLoading) return;
    if (!user || !isAdmin) return;
    fetchChallenge();
  }, [id, authLoading, user, isAdmin]);

  const fetchChallenge = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Challenge not found or access denied');
      setChallenge(data);

      // 참여자 수 조회
      const { count } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', id);
      setParticipantCount(count || 0);

      // YouTube 챌린지인 경우 정보 로드
      const options = data.options as any;
      if (options?.type === 'youtube' && options?.youtube_url) {
        await fetchYoutubeInfo(options.youtube_url);
      }

      // 당첨자 선정된 경우 당첨자 목록 로드
      if (data.selected_at) {
        await fetchWinners();
      }

      // 기본 클레임 시간 설정 (더 이상 필요 없음 - 통합 플로우에서 자동 설정)
    } catch (error: any) {
      toast({
        title: "Error loading challenge",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchYoutubeInfo = async (url: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-youtube-views', {
        body: { videoUrl: url }
      });

      if (error) throw error;

      setYoutubeInfo({
        videoId: data.videoId,
        title: data.title,
        channelTitle: data.channelTitle,
        thumbnail: data.thumbnail,
        currentViewCount: data.viewCount,
        currentLikeCount: data.likeCount,
        currentCommentCount: data.commentCount,
        fetchedAt: data.fetchedAt,
      });
    } catch (error: any) {
      console.error('Failed to fetch YouTube info:', error);
    }
  };

  const fetchWinners = async () => {
    if (!id) return;
    setLoadingWinners(true);

    try {
      // 당첨자 정보 조회 (internal + external)
      const [internalRes, externalRes] = await Promise.all([
        supabase
          .from('challenge_participations')
          .select('*')
          .eq('challenge_id', id)
          .eq('is_winner', true)
          .order('prize_amount', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('external_challenge_participations')
          .select('*')
          .eq('challenge_id', id)
          .eq('is_winner', true)
          .order('prize_amount', { ascending: false })
          .order('created_at', { ascending: true }),
      ]);

      if (internalRes.error) throw internalRes.error;
      if (externalRes.error) throw externalRes.error;

      const participations = internalRes.data || [];
      const externalParticipations = externalRes.data || [];

      // 프로필 정보 조회
      const userIds = [...new Set(participations.map((p: any) => p.user_id))];
      const externalWalletIds = [...new Set(externalParticipations.map((p: any) => p.external_wallet_id))];

      const [profilesRes, externalProfilesRes] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        externalWalletIds.length > 0
          ? supabase
              .from('external_wallet_profiles_public')
              .select('id, username, display_name, avatar_url, source')
              .in('id', externalWalletIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const externalProfileMap = new Map((externalProfilesRes.data || []).map((p: any) => [p.id, p]));

      // YouTube 챌린지인 경우 answer 차이로 재정렬
      const options = challenge?.options as any;
      const isYouTube = options?.type === 'youtube';
      const correctAnswer = challenge?.correct_answer;

      let sortedParticipations = participations || [];
      
      if (isYouTube && correctAnswer && !isNaN(Number(correctAnswer))) {
        const targetValue = Number(correctAnswer);
        sortedParticipations = [...sortedParticipations].sort((a, b) => {
          // 먼저 prize_amount로 정렬 (높은 순)
          if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
            return (b.prize_amount || 0) - (a.prize_amount || 0);
          }
          // 같은 prize_amount 내에서는 answer 차이로 정렬
          const aDiff = Math.abs(Number(a.answer) - targetValue);
          const bDiff = Math.abs(Number(b.answer) - targetValue);
          // NaN 처리: NaN은 맨 뒤로
          if (isNaN(aDiff) && isNaN(bDiff)) return 0;
          if (isNaN(aDiff)) return 1;
          if (isNaN(bDiff)) return -1;
          return aDiff - bDiff;
        });
      }

      // 내부 당첨자 (UnifiedWinner로 변환)
      const internalWinnersUnified: UnifiedWinner[] = sortedParticipations.map((p, index) => {
        const profile = profileMap.get(p.user_id);
        return {
          id: p.user_id,
          user_id: p.user_id,
          username: profile?.username || 'Anonymous',
          display_name: profile?.display_name,
          avatar_url: profile?.avatar_url,
          rank: index + 1,
          has_lightstick: p.has_lightstick || false,
          prize_amount: p.prize_amount || 0,
          answer: p.answer,
          created_at: p.created_at,
          source: 'internal' as const,
        };
      });

      // 외부 당첨자 (UnifiedWinner로 변환)
      const externalWinnersUnified: UnifiedWinner[] = (externalParticipations || []).map((p: any, index: number) => {
        const ext = externalProfileMap.get(p.external_wallet_id);
        return {
          id: p.external_wallet_id,
          external_wallet_id: p.external_wallet_id,
          username: ext?.username || 'Frame User',
          display_name: ext?.display_name || null,
          avatar_url: ext?.avatar_url || null,
          // 임시 rank (아래에서 통합 정렬/재랭킹)
          rank: internalWinnersUnified.length + index + 1,
          has_lightstick: false,
          prize_amount: Number(p.prize_amount || 0),
          answer: p.answer,
          created_at: p.created_at,
          source: 'external' as const,
        };
      });

      // 통합 리스트 (source 기준으로 붙이지 말고, 통합 정렬/재랭킹)
      // YouTube/숫자형 → 근접도순, 객관식(정답1개) → 랜덤, 그 외 → 시간순
      const sortMode: SortMode = isYouTube ? 'proximity' : (options?.type === 'multiple_choice' ? 'random' : 'time');
      const normalizedWinners = normalizeWinnersForDisplay([...internalWinnersUnified, ...externalWinnersUnified], correctAnswer, sortMode);
      setWinners(normalizedWinners);

      // 미승인 상태에서는 기존 당첨자를 previewWinners로 자동 세팅하여 Confirm 버튼 즉시 표시
      if (!challenge?.admin_approved_at && normalizedWinners.length > 0) {
        setPreviewWinners(normalizedWinners);
        setSelectedWinnerIds(new Set(normalizedWinners.map(w => w.id)));
      }

      setExcludedWinnerIds(new Set());
    } catch (error: any) {
      console.error('Failed to fetch winners:', error);
    } finally {
      setLoadingWinners(false);
    }
  };

  // 당첨자 미리보기
  const handlePreviewWinners = async () => {
    if (!challenge) return;
    setIsPreviewingWinners(true);
    setPreviewWinners([]);
    setPreviewVerification(null);

    try {
      const options = challenge.options as any;

      // YouTube 챌린지: 프리뷰 버튼 클릭 시점의 "현재 값"을 타겟으로 사용
      let previewTargetValue: string | undefined = undefined;
      if (options?.type === 'youtube' && options?.youtube_url) {
        try {
          const { data: ytData, error: ytError } = await supabase.functions.invoke('get-youtube-views', {
            body: { videoUrl: options.youtube_url }
          });

          if (!ytError && ytData) {
            // UI에도 최신 값 반영
            setYoutubeInfo({
              videoId: ytData.videoId,
              title: ytData.title,
              channelTitle: ytData.channelTitle,
              thumbnail: ytData.thumbnail,
              currentViewCount: ytData.viewCount,
              currentLikeCount: ytData.likeCount,
              currentCommentCount: ytData.commentCount,
              fetchedAt: ytData.fetchedAt,
            });

            const metric = options?.youtube_target_metric || 'viewCount';
            const metricValue = metric === 'likeCount'
              ? ytData.likeCount
              : metric === 'commentCount'
                ? ytData.commentCount
                : ytData.viewCount;

            if (typeof metricValue === 'number' && Number.isFinite(metricValue)) {
              previewTargetValue = String(metricValue);
            }
          } else {
            console.warn('[AdminChallengeReview] get-youtube-views failed:', ytError);
          }
        } catch (e) {
          console.warn('[AdminChallengeReview] Failed to refresh YouTube stats for preview:', e);
        }
      }

      const { data, error } = await supabase.functions.invoke('select-challenge-winners', {
        body: {
          challengeId: challenge.id,
          preview: true,
          previewTargetValue,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Preview failed');

      // 내부 당첨자 → UnifiedWinner
      const internalWinners: UnifiedWinner[] = (data.winners || []).map((w: any) => ({
        id: w.user_id,
        user_id: w.user_id,
        username: w.username,
        display_name: w.display_name,
        avatar_url: w.avatar_url,
        rank: w.rank,
        has_lightstick: w.has_lightstick || false,
        prize_amount: w.prize_amount,
        answer: w.answer,
        created_at: w.created_at,
        source: 'internal' as const,
      }));

      // 외부 당첨자 → UnifiedWinner
      const externalWinners: UnifiedWinner[] = (data.externalWinners || []).map((w: any) => ({
        id: w.external_wallet_id,
        external_wallet_id: w.external_wallet_id,
        wallet_address: w.wallet_address,
        username: w.username,
        display_name: w.display_name,
        avatar_url: w.avatar_url,
        rank: w.rank,
        has_lightstick: false,
        prize_amount: w.prize_amount,
        answer: w.answer,
        created_at: w.created_at,
        source: 'external' as const,
      }));

      // 통합 리스트 (source 기준으로 붙이지 말고, 통합 정렬/재랭킹)
      const previewOpts = challenge.options as any;
      const previewSortMode: SortMode = previewOpts?.type === 'youtube' ? 'proximity' : (previewOpts?.type === 'multiple_choice' ? 'random' : 'time');
      const previewCorrectAnswer = challenge.correct_answer || previewTargetValue;
      const allWinners = normalizeWinnersForDisplay([...internalWinners, ...externalWinners], previewCorrectAnswer, previewSortMode);
      setPreviewWinners(allWinners);
      
      // 초기에는 모든 당첨자가 선택된 상태
      setSelectedWinnerIds(new Set(allWinners.map(w => w.id)));
      setPreviewVerification(data.verification || null);

      toast({
        title: "Preview Complete",
        description: `${(data.winners?.length || 0) + (data.externalWinners?.length || 0)} winner(s) would be selected`,
      });
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPreviewingWinners(false);
    }
  };

  // 당첨자 토글
  const toggleWinnerSelection = (userId: string) => {
    setSelectedWinnerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleAllWinners = () => {
    if (selectedWinnerIds.size === previewWinners.length) {
      setSelectedWinnerIds(new Set());
    } else {
      setSelectedWinnerIds(new Set(previewWinners.map(w => w.id)));
    }
  };

  // 당첨자 선정 (확정) - 선택된 유저만
  // 당첨자 확정 + 승인 + 상금 지급 (통합 핸들러)
  const handleConfirmAndApprove = async () => {
    if (!challenge) return;
    
    if (selectedWinnerIds.size === 0) {
      toast({
        title: "No Winners Selected",
        description: "Please select at least one winner",
        variant: "destructive",
      });
      return;
    }

    // admin_approved_at이 있으면 이미 사용자에게 공개된 상태 → 재선정 불가
    if (challenge.admin_approved_at) {
      toast({
        title: "Already Approved",
        description: "Winners have already been approved and published to users",
        variant: "destructive",
      });
      return;
    }

    // 확인 다이얼로그
    if (!confirm(`Are you sure you want to confirm ${selectedWinnerIds.size} winner(s) and distribute prizes? This action cannot be undone.`)) {
      return;
    }

    setIsSelectingWinners(true);
    setOnchainStatus({ step: 'distributing' });

    try {
      // 1. 선택된 당첨자만 필터링
      const selectedWinners = previewWinners.filter(w => selectedWinnerIds.has(w.id));
      
      // internal과 external 분리 (전체 정보 포함)
      const selectedInternalWinners = selectedWinners
        .filter(w => w.source === 'internal')
        .map(w => ({
          user_id: w.user_id,
          prize_amount: w.prize_amount,
          has_lightstick: w.has_lightstick,
          rank: w.rank,
        }));
      const selectedExternalWinners = selectedWinners
        .filter(w => w.source === 'external')
        .map(w => ({
          external_wallet_id: w.external_wallet_id,
          prize_amount: w.prize_amount,
          has_lightstick: w.has_lightstick,
          rank: w.rank,
        }));
      
      // 2. 당첨자 DB 저장
      const { data, error } = await supabase.functions.invoke('select-challenge-winners', {
        body: { 
          challengeId: challenge.id, 
          preview: false,
          confirmWinners: {
            internal: selectedInternalWinners,
            external: selectedExternalWinners,
          },
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Selection failed');

      // 3. 챌린지 상태 업데이트 (승인)
      const now = new Date();
      const claimEndTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후
      
      const { error: updateError } = await supabase
        .from('challenges')
        .update({
          admin_approved_at: now.toISOString(),
          admin_approved_by: user?.id,
          claim_start_time: now.toISOString(),
          claim_end_time: claimEndTime.toISOString(),
          status: 'approved',
        })
        .eq('id', challenge.id);

      if (updateError) throw updateError;

      // 4. Internal 당첨자들에게 알림 발송 + 상금 지급
      if (selectedInternalWinners.length > 0) {
        // 알림 생성
        const notifications = selectedInternalWinners.map(winner => ({
          user_id: winner.user_id,
          type: 'challenge_win',
          title: 'Congratulations! You won! 🎉',
          message: `You won $${winner.prize_amount} USDC in the challenge! Claim your prize now.`,
          reference_id: challenge.id,
        }));

        await supabase.from('notifications').insert(notifications);

        // 지갑 주소 조회
        const userIds = selectedInternalWinners.map(w => w.user_id).filter(Boolean) as string[];
        const { data: wallets } = await supabase
          .from('wallet_addresses')
          .select('user_id, wallet_address')
          .in('user_id', userIds);

        const walletMap = new Map((wallets || []).map(w => [w.user_id, w.wallet_address]));

        // DB 기반 상금 배포 (유저당 최고 상금 하나만 전송)
        const uniqueWinnerMap = new Map<string, { userId: string; amount: number; address?: string }>();
        for (const w of selectedInternalWinners) {
          if (!w.user_id) continue;
          const existing = uniqueWinnerMap.get(w.user_id);
          if (!existing || (w.prize_amount || 0) > existing.amount) {
            uniqueWinnerMap.set(w.user_id, {
              userId: w.user_id,
              amount: w.prize_amount || 0,
              address: walletMap.get(w.user_id),
            });
          }
        }
        const prizeWinners = Array.from(uniqueWinnerMap.values());

        const { data: dbData, error: dbError } = await supabase.functions.invoke('distribute-prizes-db', {
          body: {
            challengeId: challenge.id,
            winners: prizeWinners,
          }
        });

        if (dbError || !dbData?.success) {
          setOnchainStatus({ 
            step: 'idle', 
            error: dbError?.message || dbData?.error || 'Prize distribution failed' 
          });
          toast({
            title: "Winners Saved (Distribution Failed)",
            description: `Winners confirmed but prize distribution failed: ${dbData?.error || 'Unknown error'}`,
            variant: "destructive",
          });
        } else {
          setOnchainStatus({ step: 'idle', success: true });
          toast({
            title: "Winners Confirmed & Prizes Distributed! 🎉",
            description: `${dbData.data?.successCount} winner(s) received $${dbData.data?.totalDistributed} USDC.`,
          });
        }
      } else {
        toast({
          title: "Winners Confirmed!",
          description: `${selectedExternalWinners.length} external winner(s) confirmed. External prizes need manual distribution.`,
        });
      }

      // 데이터 리로드
      await fetchChallenge();
      setPreviewWinners([]);
      setSelectedWinnerIds(new Set());
      setPreviewVerification(null);
    } catch (error: any) {
      setOnchainStatus({ step: 'idle', error: error.message });
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSelectingWinners(false);
      setOnchainStatus({ step: 'idle' });
    }
  };

  // 답변 백필 (숫자로 변환)
  const handleBackfillAnswers = async () => {
    if (!challenge) return;
    if (!confirm("This will convert all answers to numbers (e.g., '800k' → '800000'). Continue?")) return;

    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-challenge-answers', {
        body: { challengeId: challenge.id }
      });

      if (error) throw error;

      toast({
        title: "Backfill Complete",
        description: `Updated ${data.updated} answers, skipped ${data.skipped}`,
      });
    } catch (error: any) {
      toast({
        title: "Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  // 객관식 정답 저장
  const handleSaveCorrectAnswer = async () => {
    if (!challenge || !selectedAnswer) return;
    setIsSavingAnswer(true);
    
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ correct_answer: selectedAnswer })
        .eq('id', challenge.id);
      
      if (error) throw error;
      
      // 로컬 상태 업데이트
      setChallenge(prev => prev ? { ...prev, correct_answer: selectedAnswer } : prev);
      
      toast({
        title: "Answer Saved",
        description: `Correct answer set to: ${getAnswerDisplay(selectedAnswer)}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingAnswer(false);
    }
  };

  // 답변 표시 변환
  const getAnswerDisplay = (answer: string) => {
    if (!challenge) return answer;
    const options = challenge.options as any;
    if (options?.type === 'multiple_choice' && options?.items) {
      const item = options.items.find((i: any) => i.id === answer);
      if (item) {
        return `${item.label}: ${item.wiki_entry_title || item.text || ''}`;
      }
    }
    return answer;
  };

  // 챌린지 타입 확인
  const challengeType = useMemo(() => {
    if (!challenge) return 'subjective';
    const options = challenge.options as any;
    return options?.type || 'subjective';
  }, [challenge]);

  // 타겟 메트릭
  const targetMetric = useMemo(() => {
    if (!challenge) return 'viewCount';
    const options = challenge.options as any;
    return options?.youtube_target_metric || 'viewCount';
  }, [challenge]);

  // 정답 데이터
  const fetchedAnswerData = useMemo(() => {
    if (!challenge) return null;
    const options = challenge.options as any;
    return options?.fetched_stats || null;
  }, [challenge]);


  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <p className="text-center text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <p className="text-center text-muted-foreground">Challenge not found</p>
        </div>
      </div>
    );
  }

  const isYouTubeChallenge = challengeType === 'youtube';
  const isApproved = !!challenge.admin_approved_at;
  const hasWinners = !!challenge.selected_at;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin?tab=challenges')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Challenge Review</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve challenge results
            </p>
          </div>
          <Badge 
            variant={isApproved ? "default" : hasWinners ? "secondary" : "outline"}
            className={cn(
              isApproved && "bg-green-500",
              hasWinners && !isApproved && "bg-yellow-500"
            )}
          >
            {isApproved ? 'Approved' : hasWinners ? 'Awaiting Approval' : 'Pending'}
          </Badge>
        </div>

        {/* 챌린지 정보 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg">{challenge.question}</CardTitle>
                <CardDescription className="mt-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      End: {format(new Date(challenge.end_time), 'yyyy-MM-dd HH:mm')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {participantCount} participants
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${challenge.total_prize_usdc} USDC
                    </span>
                  </div>
                </CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0">
                {isYouTubeChallenge ? (
                  <><Youtube className="h-3 w-3 mr-1 text-red-500" /> YouTube</>
                ) : challengeType === 'multiple_choice' ? (
                  'Multiple Choice'
                ) : (
                  'Open-ended'
                )}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* YouTube 정보 카드 */}
        {isYouTubeChallenge && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                YouTube Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 비디오 썸네일 및 정보 */}
              {youtubeInfo ? (
                <div className="flex gap-4">
                  {youtubeInfo.thumbnail && (
                    <a
                      href={`https://youtube.com/watch?v=${youtubeInfo.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={youtubeInfo.thumbnail}
                        alt={youtubeInfo.title}
                        className="w-48 h-auto rounded-lg hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-medium line-clamp-2">{youtubeInfo.title}</h3>
                    <p className="text-sm text-muted-foreground">{youtubeInfo.channelTitle}</p>
                    <a
                      href={`https://youtube.com/watch?v=${youtubeInfo.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open in YouTube <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  YouTube URL: {(challenge.options as any)?.youtube_url}
                </div>
              )}

              <Separator />

              {/* 현재 통계 */}
              {youtubeInfo && (
                <div className="grid grid-cols-3 gap-4">
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    targetMetric === 'viewCount' && "bg-primary/10 ring-2 ring-primary"
                  )}>
                    <div className="text-2xl font-bold">
                      {youtubeInfo.currentViewCount?.toLocaleString() || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Eye className="h-3 w-3" /> Views
                      {targetMetric === 'viewCount' && <Badge className="text-[10px] h-4 ml-1">Target</Badge>}
                    </div>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    targetMetric === 'likeCount' && "bg-primary/10 ring-2 ring-primary"
                  )}>
                    <div className="text-2xl font-bold">
                      {youtubeInfo.currentLikeCount?.toLocaleString() || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      👍 Likes
                      {targetMetric === 'likeCount' && <Badge className="text-[10px] h-4 ml-1">Target</Badge>}
                    </div>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    targetMetric === 'commentCount' && "bg-primary/10 ring-2 ring-primary"
                  )}>
                    <div className="text-2xl font-bold">
                      {youtubeInfo.currentCommentCount?.toLocaleString() || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      💬 Comments
                      {targetMetric === 'commentCount' && <Badge className="text-[10px] h-4 ml-1">Target</Badge>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 정답 데이터 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Answer Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 초기값 표시 (YouTube 챌린지) */}
            {isYouTubeChallenge && (() => {
              const opts = challenge.options as any;
              return (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-2">Initial Value (at creation)</div>
                  <div className="text-xl font-bold">
                    {targetMetric === 'viewCount' && (
                      <span>👁️ {Number(opts?.youtube_initial_views || 0).toLocaleString()} views</span>
                    )}
                    {targetMetric === 'likeCount' && (
                      <span>❤️ {Number(opts?.youtube_initial_likes || 0).toLocaleString()} likes</span>
                    )}
                    {targetMetric === 'commentCount' && (
                      <span>💬 {Number(opts?.youtube_initial_comments || 0).toLocaleString()} comments</span>
                    )}
                  </div>
                  {opts?.youtube_fetched_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Fetched at: {format(new Date(opts.youtube_fetched_at as string), 'yyyy-MM-dd HH:mm:ss')}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 정답 패칭 시간 */}
            {challenge.answer_fetch_time && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Answer Fetch Time:</span>
                <span className="font-medium">
                  {format(new Date(challenge.answer_fetch_time), 'yyyy-MM-dd HH:mm:ss')}
                </span>
              </div>
            )}

            {/* 정답 */}
            <div className={cn(
              "p-4 rounded-lg border",
              challenge.correct_answer 
                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                : "bg-muted/50 border-border"
            )}>
              <div className="text-sm text-muted-foreground mb-1">Correct Answer</div>
              
              {/* 객관식: 정답 미설정 시 선택 UI 표시 */}
              {challengeType === 'multiple_choice' && !challenge.correct_answer && (
                <div className="space-y-3">
                  <Select
                    value={selectedAnswer}
                    onValueChange={setSelectedAnswer}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select correct answer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {((challenge.options as any)?.items || []).map((item: any) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.label}: {item.wiki_entry_title || item.text || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSaveCorrectAnswer}
                    disabled={!selectedAnswer || isSavingAnswer}
                    className="w-full"
                  >
                    {isSavingAnswer ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save Correct Answer
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* 정답이 설정되어 있는 경우 표시 */}
              {challenge.correct_answer && (
                <div className={cn(
                  "text-2xl font-bold",
                  "text-green-600 dark:text-green-400"
                )}>
                  {isYouTubeChallenge ? (
                    Number(challenge.correct_answer).toLocaleString()
                  ) : (
                    getAnswerDisplay(challenge.correct_answer)
                  )}
                </div>
              )}
              
              {/* 정답 미설정 + 객관식 아닌 경우 */}
              {!challenge.correct_answer && challengeType !== 'multiple_choice' && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  Not fetched yet
                </span>
              )}
              
              {isYouTubeChallenge && challenge.correct_answer && (
                <div className="text-xs text-muted-foreground mt-1">
                  {targetMetric === 'viewCount' ? 'Views' : 
                   targetMetric === 'likeCount' ? 'Likes' : 'Comments'}
                </div>
              )}
            </div>

            {/* API에서 가져온 추가 데이터 */}
            {fetchedAnswerData && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Fetched Statistics</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground text-xs">Views</div>
                    <div className="font-mono">{fetchedAnswerData.viewCount?.toLocaleString() || '-'}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground text-xs">Likes</div>
                    <div className="font-mono">{fetchedAnswerData.likeCount?.toLocaleString() || '-'}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground text-xs">Comments</div>
                    <div className="font-mono">{fetchedAnswerData.commentCount?.toLocaleString() || '-'}</div>
                  </div>
                </div>
                {fetchedAnswerData.fetchedAt && (
                  <div className="text-xs text-muted-foreground">
                    Fetched at: {format(new Date(fetchedAnswerData.fetchedAt), 'yyyy-MM-dd HH:mm:ss')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 당첨자 미리보기 / 선정 (미선정 또는 당첨자 0명인 경우 재선정 허용) - 정답 없어도 섹션은 표시 */}
        {(!hasWinners || (!loadingWinners && winners.length === 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Winner Selection
              </CardTitle>
              <CardDescription>
                Preview or finalize winner selection ({participantCount} participants)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePreviewWinners}
                  disabled={isPreviewingWinners || isSelectingWinners}
                  variant="outline"
                >
                  {isPreviewingWinners ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {previewWinners.length > 0 ? 'Re-shuffling...' : 'Previewing...'}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      {previewWinners.length > 0 ? 'Re-shuffle Winners' : 'Preview Winners'}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleConfirmAndApprove}
                  disabled={isPreviewingWinners || isSelectingWinners || previewWinners.length === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSelectingWinners ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Distribute Prizes
                    </>
                  )}
                </Button>
                {isYouTubeChallenge && (
                  <Button
                    onClick={handleBackfillAnswers}
                    disabled={isBackfilling}
                    variant="outline"
                    className="border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  >
                    {isBackfilling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Hash className="h-4 w-4 mr-2" />
                        Backfill Answers
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* 프리뷰 검증 정보 */}
              {previewVerification && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div className="font-medium mb-2">Selection Preview</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Total Eligible: {previewVerification.total_eligible}</div>
                    <div>Lightstick Holders: {previewVerification.lightstick_holders}</div>
                    <div>Non-holders: {previewVerification.non_lightstick_holders}</div>
                    <div>Winners: {previewVerification.winner_count}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    7:3 ratio applied (Lightstick: {previewVerification.winners_with_lightstick}, Non: {previewVerification.winners_without_lightstick})
                  </div>
                </div>
              )}

              {/* 프리뷰 당첨자 목록 - 체크박스로 선별 가능 */}
              {previewWinners.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedWinnerIds.size} of {previewWinners.length} selected
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAllWinners}
                    >
                      {selectedWinnerIds.size === previewWinners.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox 
                              checked={selectedWinnerIds.size === previewWinners.length && previewWinners.length > 0}
                              onCheckedChange={toggleAllWinners}
                            />
                          </TableHead>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Answer</TableHead>
                          <TableHead className="text-center">🪄</TableHead>
                          <TableHead className="text-right">Prize</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewWinners.map((winner, index) => {
                          const isSelected = selectedWinnerIds.has(winner.id);
                          const isExternal = winner.source === 'external';
                          return (
                            <TableRow 
                              key={winner.id}
                              className={cn(
                                "cursor-pointer transition-colors",
                                !isSelected && "opacity-50 bg-muted/30"
                              )}
                              onClick={() => toggleWinnerSelection(winner.id)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleWinnerSelection(winner.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isExternal && (
                                    <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" title="Farcaster" />
                                  )}
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={winner.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {(winner.display_name || winner.username || '?')[0].toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className={cn("text-sm", !isSelected && "line-through")}>
                                    {winner.display_name || winner.username}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {isNaN(Number(winner.answer)) ? (
                                  <span className="text-yellow-600 dark:text-yellow-400" title={`Original: ${winner.answer}`}>
                                    NaN <span className="text-xs text-muted-foreground">({winner.answer})</span>
                                  </span>
                                ) : (
                                  <>
                                    {Number(winner.answer).toLocaleString()}
                                    {(winner as any).difference !== undefined && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        (±{Number((winner as any).difference).toLocaleString()})
                                      </span>
                                    )}
                                  </>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {winner.has_lightstick ? (
                                  <span className="text-lg">🪄</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${winner.prize_amount}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedWinnerIds.size < previewWinners.length && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>{previewWinners.length - selectedWinnerIds.size} user(s) will be excluded from winning</span>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* 당첨자 선정 정보 */}
        {hasWinners && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Selection Verification
              </CardTitle>
              <CardDescription>
                On-chain verifiable randomness data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {challenge.selection_block_number && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Block Number:</span>
                  <code className="bg-muted px-2 py-0.5 rounded">{challenge.selection_block_number}</code>
                </div>
              )}
              {challenge.selection_block_hash && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Block Hash:</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs truncate max-w-[300px]">
                    {challenge.selection_block_hash}
                  </code>
                  <a
                    href={`https://basescan.org/block/${challenge.selection_block_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {challenge.selection_seed && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Selection Seed:</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs truncate max-w-[300px]">
                    {challenge.selection_seed}
                  </code>
                </div>
              )}
              {challenge.selected_at && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Selected At:</span>
                  <span>{format(new Date(challenge.selected_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 당첨자 리스트 */}
        {hasWinners && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                {/* Re-Preview 후에는 previewWinners 표시 */}
                {previewWinners.length > 0 ? (
                  <>New Preview ({selectedWinnerIds.size} / {previewWinners.length})</>
                ) : (
                  <>Winners ({winners.length - excludedWinnerIds.size} / {winners.length})</>
                )}
              </CardTitle>
              <CardDescription className="flex items-center justify-between flex-wrap gap-2">
                <span>
                  {previewWinners.length > 0 
                    ? 'Check/uncheck to select winners, then confirm'
                    : 'Uncheck to exclude from prize distribution'
                  }
                </span>
                {!challenge?.admin_approved_at && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePreviewWinners}
                      disabled={isPreviewingWinners}
                    >
                      {isPreviewingWinners ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-1" />
                      )}
                      Re-Preview
                    </Button>
                    {previewWinners.length > 0 && (
                      <Button
                        size="sm"
                        onClick={handleConfirmAndApprove}
                        disabled={isSelectingWinners || selectedWinnerIds.size === 0}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isSelectingWinners ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Gift className="h-4 w-4 mr-1" />
                        )}
                        Confirm & Distribute ({selectedWinnerIds.size})
                      </Button>
                    )}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingWinners ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (() => {
                // Re-Preview 후에는 previewWinners 사용, 아니면 기존 winners 사용
                const displayList = previewWinners.length > 0 ? previewWinners : winners;
                const isPreviewMode = previewWinners.length > 0;
                
                if (displayList.length === 0) {
                  return <p className="text-center text-muted-foreground py-4">No winners yet</p>;
                }
                
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {isPreviewMode ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedWinnerIds(new Set(previewWinners.map(w => w.id)))}
                            disabled={selectedWinnerIds.size === previewWinners.length}
                          >
                            Select All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedWinnerIds(new Set())}
                            disabled={selectedWinnerIds.size === 0}
                          >
                            Deselect All
                          </Button>
                          {selectedWinnerIds.size < previewWinners.length && (
                            <span className="text-sm text-yellow-600 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              {previewWinners.length - selectedWinnerIds.size} excluded
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExcludedWinnerIds(new Set())}
                            disabled={excludedWinnerIds.size === 0}
                          >
                            Select All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExcludedWinnerIds(new Set(winners.map(w => w.id)))}
                            disabled={excludedWinnerIds.size === winners.length}
                          >
                            Deselect All
                          </Button>
                          {excludedWinnerIds.size > 0 && (
                            <span className="text-sm text-yellow-600 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              {excludedWinnerIds.size} excluded
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">✓</TableHead>
                            <TableHead className="w-16">Rank</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Answer</TableHead>
                            <TableHead className="w-16 text-center">🪄</TableHead>
                            <TableHead className="w-24 text-right">Prize</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayList.map((winner) => {
                            const isSelected = isPreviewMode 
                              ? selectedWinnerIds.has(winner.id) 
                              : !excludedWinnerIds.has(winner.id);
                            const isExternal = winner.source === 'external';
                            return (
                              <TableRow 
                                key={winner.id + winner.rank}
                                className={cn(!isSelected && "opacity-40 bg-muted/30")}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (isPreviewMode) {
                                        const newSelected = new Set(selectedWinnerIds);
                                        if (checked) {
                                          newSelected.add(winner.id);
                                        } else {
                                          newSelected.delete(winner.id);
                                        }
                                        setSelectedWinnerIds(newSelected);
                                      } else {
                                        const newExcluded = new Set(excludedWinnerIds);
                                        if (checked) {
                                          newExcluded.delete(winner.id);
                                        } else {
                                          newExcluded.add(winner.id);
                                        }
                                        setExcludedWinnerIds(newExcluded);
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-semibold">
                                    {winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : winner.rank === 3 ? '🥉' : `#${winner.rank}`}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isExternal && (
                                      <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" title="Farcaster" />
                                    )}
                                    {isExternal ? (
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                          <AvatarImage src={winner.avatar_url || undefined} />
                                          <AvatarFallback className="text-xs">
                                            {(winner.display_name || winner.username || '?')[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{winner.display_name || winner.username}</span>
                                      </div>
                                    ) : (
                                      <Link
                                        to={`/u/${winner.username}`}
                                        className="flex items-center gap-2 hover:underline"
                                      >
                                        <Avatar className="h-7 w-7">
                                          <AvatarImage src={winner.avatar_url || undefined} />
                                          <AvatarFallback className="text-xs">
                                            {(winner.display_name || winner.username || '?')[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{winner.display_name || winner.username}</span>
                                      </Link>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-[150px]">
                                  <div className="truncate text-sm">
                                    {isYouTubeChallenge 
                                      ? Number(winner.answer).toLocaleString()
                                      : getAnswerDisplay(winner.answer)
                                    }
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {winner.has_lightstick ? (
                                    <span title="Lightstick Holder">🪄</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right font-semibold",
                                  !isSelected ? "text-muted-foreground line-through" : "text-green-600"
                                )}>
                                  ${winner.prize_amount}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* 온체인 상태/에러 표시 (통합 플로우에서 사용) */}
        {onchainStatus.step !== 'idle' && !isApproved && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-blue-600">
                  {onchainStatus.step === 'distributing' && 'Distributing prizes...'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {onchainStatus.error && !isApproved && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{onchainStatus.error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 이미 승인됨 */}
        {isApproved && (
          <Card className="border-2 border-green-500/50">
            <CardContent className="py-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-green-600">Challenge Approved</div>
                  <div className="text-sm text-muted-foreground">
                    Approved at: {format(new Date(challenge.admin_approved_at!), 'yyyy-MM-dd HH:mm')}
                  </div>
                  {challenge.claim_start_time && (
                    <div className="text-sm text-muted-foreground">
                      Claim period: {format(new Date(challenge.claim_start_time), 'MMM d, HH:mm')}
                      {challenge.claim_end_time && ` - ${format(new Date(challenge.claim_end_time), 'MMM d, HH:mm')}`}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRetryingOnchain}
                  onClick={async () => {
                    try {
                      setIsRetryingOnchain(true);
                      toast({ title: "Retrying onchain recording...", description: "Syncing nonce and re-submitting batch participations." });
                      const { data, error } = await supabase.functions.invoke('record-challenge-onchain', {
                        body: { challengeId: challenge.id },
                      });
                      if (error) throw error;
                      if (data?.success) {
                        toast({ title: "Onchain Recording Complete ✅", description: `${data.data?.totalRecorded || 0} recorded, ${data.data?.alreadyOnchain || 0} already onchain, ${data.data?.totalFailed || 0} failed.` });
                      } else {
                        toast({ title: "Onchain Recording Failed", description: data?.error || 'Unknown error', variant: "destructive" });
                      }
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    } finally {
                      setIsRetryingOnchain(false);
                    }
                  }}
                >
                  {isRetryingOnchain ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Hash className="h-4 w-4 mr-1" />
                  )}
                  {isRetryingOnchain ? 'Recording...' : 'Retry Onchain'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminChallengeReview;
