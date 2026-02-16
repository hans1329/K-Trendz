import { useState, useEffect, useMemo, memo, useRef } from "react";
import { usePageTranslation } from "@/hooks/usePageTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trophy, Clock, Users, DollarSign, Gift, Loader2, CheckCircle2, HelpCircle, Info, Star, ExternalLink, ChevronDown, ChevronUp, X, Wand2, Share2, Copy, Check, Wallet, LogIn } from "lucide-react";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFingerprint } from "@/hooks/useFingerprint";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import BuyFanzTokenDialog from "./BuyFanzTokenDialog";
interface WikiEntryBasic {
  id: string;
  title: string;
  image_url: string | null;
  slug?: string;
}
interface PrizeTier {
  rank: number;
  amount: number;
  count: number;
}
interface MultipleChoiceItem {
  id: string;
  label?: string;
  wiki_entry_id?: string | null;
  wiki_entry_title?: string | null;
  text?: string | null;
}
interface ChallengeOptions {
  type?: string;
  items?: MultipleChoiceItem[];
  choices?: string[];
  prize_tiers?: PrizeTier[];
  [key: string]: any;
}
interface Challenge {
  id: string;
  question: string;
  options: string[] | ChallengeOptions;
  total_prize_usdc: number;
  winner_count: number;
  prize_with_lightstick: number;
  prize_without_lightstick: number;
  wiki_entry_id: string | null;
  start_time: string;
  end_time: string;
  entry_cost?: number;
  image_url?: string | null;
  correct_answer?: string;
  selected_at?: string;
  admin_approved_at?: string;
  claim_start_time?: string;
  claim_end_time?: string;
  answer_fetch_time?: string;
  selection_tx_hash?: string | null;
  onchain_challenge_id?: number | null;
  wiki_entry?: {
    id: string;
    title: string;
    image_url: string | null;
    slug: string;
  } | null;
  wiki_entries?: WikiEntryBasic[];
}
interface ChallengeCardProps {
  challenge: Challenge;
  onParticipationComplete?: () => void;
  showOriginal?: boolean;
}

// 카운트다운 컴포넌트 - 메모이제이션 + IntersectionObserver로 화면에 보일 때만 갱신
const CountdownTimer = memo(({
  endTime
}: {
  endTime: string;
}) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [isVisible, setIsVisible] = useState(true);
  const timeLeftRef = useRef(timeLeft);
  const containerRef = useRef<HTMLDivElement>(null);
  timeLeftRef.current = timeLeft;

  // IntersectionObserver로 화면에 보일 때만 타이머 갱신
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, {
      threshold: 0.1
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const endTimestamp = new Date(endTime).getTime();
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = Math.max(0, endTimestamp - now);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(diff % (1000 * 60) / 1000);
      const current = timeLeftRef.current;
      // 값이 동일하면 업데이트 스킵
      if (hours === current.hours && minutes === current.minutes && seconds === current.seconds) {
        return;
      }
      setTimeLeft({
        hours,
        minutes,
        seconds
      });
    };
    calculateTimeLeft();

    // 화면에 보이지 않으면 타이머 중지
    if (!isVisible) return;
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endTime, isVisible]);
  return <div ref={containerRef} className="flex items-center gap-1 text-sm font-mono text-white">
      <span>{String(timeLeft.hours).padStart(2, '0')}:</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}:</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>;
});
interface Participant {
  id: string;
  user_id: string;
  created_at: string;
  has_lightstick: boolean;
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
export function ChallengeCard({
  challenge,
  onParticipationComplete,
  showOriginal: parentShowOriginal
}: ChallengeCardProps) {
  const {
    user,
    profile
  } = useAuth();
  const {
    fingerprint
  } = useFingerprint();
  const navigate = useNavigate();
  const {
    signInWithWallet,
    isProcessing: isWalletProcessing
  } = useWalletAuth({
    redirectTo: '/challenges'
  });
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]); // 중복 참여 지원
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 챌린지 질문 + UI 라벨 번역 (보기는 제외)
  const { t: tQ } = usePageTranslation({
    cacheKey: `challenge-q-${challenge.id}`,
    overrideShowOriginal: parentShowOriginal,
    segments: {
      question: challenge.question,
      badge: 'K-POP Challenge',
      starts_in: 'Starts in',
      results: 'Results',
      results_at: 'Results at',
      results_pending: 'Results pending...',
      results_within: '🏆 Results within 24h',
      ends: 'Ends',
      recent_participants: 'Recent Participants',
      view_all: 'View all',
    },
  });

  // 당첨 상태
  const [isWinner, setIsWinner] = useState(false);
  const [prizeAmount, setPrizeAmount] = useState<number | null>(null);
  const [winnerRank, setWinnerRank] = useState<number | null>(null);
  const [winningAnswer, setWinningAnswer] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // QuestN 외부 지갑 연결 상태
  const [hasExternalWallet, setHasExternalWallet] = useState(false);
  const [externalWalletAddress, setExternalWalletAddress] = useState<string | null>(null);
  const [isConnectingExternalWallet, setIsConnectingExternalWallet] = useState(false);

  // 위너 카드 공유 페이지 URL 생성 (OG 이미지 포함)
  const getWinnerShareUrl = () => {
    const params = new URLSearchParams({
      rank: String(winnerRank || 1),
      prize: String(prizeAmount || 0),
      username: profile?.username || 'Winner'
    });
    return `https://k-trendz.com/winner/${challenge.id}?${params.toString()}`;
  };

  // 공유 링크 복사
  const handleShareWin = async () => {
    const shareUrl = getWinnerShareUrl();
    const shareText = `🏆 I won $${prizeAmount?.toFixed(2) || '0.00'} on KTRENDZ Challenge!\n\nJoin KTRENDZ and win prizes! 🎯`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KTRENDZ Challenge Winner!',
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        // 사용자가 취소했거나 Web Share API 실패 시 클립보드 복사로 폴백
      }
    }

    // 클립보드에 복사
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setIsCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  // 위너 리스트 상태 (결과 발표 후 표시)
  interface Winner {
    id: string;
    user_id: string;
    prize_amount: number | null;
    has_lightstick: boolean;
    answer: string;
    profile: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);

  // YouTube 실시간 조회수 상태
  const [liveViewCount, setLiveViewCount] = useState<number | null>(null);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  // 응원봉 소유 여부 확인
  const [hasLightstick, setHasLightstick] = useState(false);
  // 팬 자격 여부 (아티스트 팔로우 또는 토큰 보유)
  const [isFanEligible, setIsFanEligible] = useState(true);
  const [eligibleArtists, setEligibleArtists] = useState<string[]>([]);

  // 선택지 wiki_entry 정보 (이미지, fanz_token 가격)
  const [choiceWikiInfo, setChoiceWikiInfo] = useState<Record<string, {
    image_url: string | null;
    slug?: string;
    fanzToken?: {
      id: string;
      base_price: number;
      k_value: number;
      total_supply: number;
    } | null;
    priceUsd?: number;
  }>>({});

  // 확인 다이얼로그 상태
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Stars 부족 다이얼로그 상태
  const [showInsufficientStarsDialog, setShowInsufficientStarsDialog] = useState(false);
  const [requiredStars, setRequiredStars] = useState(0);

  // 응원봉 미보유 권유 다이얼로그 상태
  const [showLightstickPromptDialog, setShowLightstickPromptDialog] = useState(false);

  // 응원봉 보유 상태가 확인되면(온체인/DB) 권유 모달이 잘못 떠있는 경우 자동으로 닫는다.
  useEffect(() => {
    if (hasLightstick && showLightstickPromptDialog) {
      setShowLightstickPromptDialog(false);
    }
  }, [hasLightstick, showLightstickPromptDialog]);

  // 구매 다이얼로그 상태
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedTokenForBuy, setSelectedTokenForBuy] = useState<{
    id: string;
    onchainBuyCostUsd: number;
    supply: number;
  } | null>(null);

  // YouTube URL에서 video ID 추출
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // YouTube 챌린지인 경우 options에서 URL 가져오기
  const challengeOptions = challenge.options as any;
  const youtubeUrlFromOptions = challengeOptions?.youtube_url || challengeOptions?.youtube_video_id;
  const youtubeVideoIdFromOptions = challengeOptions?.youtube_video_id;

  // options에서 먼저 확인, 없으면 image_url에서 확인
  const isYouTubeChallenge = challengeOptions?.type === 'youtube';
  const youtubeUrl = youtubeUrlFromOptions || (challenge.image_url && (challenge.image_url.includes('youtube.com') || challenge.image_url.includes('youtu.be')) ? challenge.image_url : null);
  const youtubeVideoId = youtubeVideoIdFromOptions || (youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null);
  const isYouTubeUrl = !!youtubeVideoId;

  // 관련 아티스트 목록 가져오기
  const relatedWikiEntryIds = useMemo(() => {
    const ids: string[] = [];
    if (challenge.wiki_entry_id) ids.push(challenge.wiki_entry_id);
    if (challenge.wiki_entries) {
      ids.push(...challenge.wiki_entries.map(e => e.id));
    }
    return [...new Set(ids)];
  }, [challenge]);

  // 참여자 그룹화 (중복 참여자는 count로 표시)
  const groupedParticipants = useMemo(() => {
    const grouped = new Map<string, Participant & {
      count: number;
    }>();
    for (const p of participants) {
      const existing = grouped.get(p.user_id);
      if (existing) {
        existing.count++;
        // 가장 최근 참여 정보로 업데이트
        if (new Date(p.created_at) > new Date(existing.created_at)) {
          existing.created_at = p.created_at;
          existing.has_lightstick = p.has_lightstick;
        }
      } else {
        grouped.set(p.user_id, {
          ...p,
          count: 1
        });
      }
    }
    return Array.from(grouped.values());
  }, [participants]);

  // QuestN 외부 지갑 연결 여부 확인
  const checkExternalWallet = async () => {
    if (!user) return;
    const {
      data
    } = await supabase.from('wallet_addresses').select('wallet_address').eq('user_id', user.id).eq('wallet_type', 'external').maybeSingle();
    if (data) {
      setHasExternalWallet(true);
      setExternalWalletAddress(data.wallet_address);
    }
  };

  // 외부 지갑 연결 (MetaMask)
  // 모바일 디바이스 감지
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // MetaMask 인앱 브라우저인지 확인
  const isMetaMaskInAppBrowser = () => {
    return !!(window as any).ethereum?.isMetaMask;
  };
  const connectExternalWallet = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    // 모바일에서 MetaMask가 없는 경우 딥링크로 리다이렉트
    if (!(window as any).ethereum) {
      if (isMobileDevice()) {
        // MetaMask 딥링크 - 현재 URL을 MetaMask 인앱 브라우저에서 열기
        const currentUrl = encodeURIComponent(window.location.href);
        const metamaskDeepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}`;
        toast.info('Opening MetaMask app...', {
          duration: 3000
        });

        // MetaMask 앱으로 리다이렉트
        window.location.href = metamaskDeepLink;
        return;
      } else {
        // 데스크톱에서는 MetaMask 설치 안내
        toast.error('Please install MetaMask extension');
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
    }
    setIsConnectingExternalWallet(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      const walletAddress = accounts[0].toLowerCase();

      // 서명 요청으로 소유권 증명
      const signer = await provider.getSigner();
      const message = `I am linking this wallet to my K-Trendz account.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      if (!signature) {
        throw new Error('Signature rejected');
      }

      // wallet_addresses에 저장
      const {
        error
      } = await supabase.from('wallet_addresses').upsert({
        user_id: user.id,
        wallet_address: walletAddress,
        wallet_type: 'external',
        network: 'base'
      }, {
        onConflict: 'user_id,wallet_type'
      });
      if (error) {
        // 중복 지갑 확인
        if (error.code === '23505') {
          toast.error('This wallet is already linked to another account');
        } else {
          throw error;
        }
      } else {
        setHasExternalWallet(true);
        setExternalWalletAddress(walletAddress);
        toast.success('Wallet linked successfully! You can now earn QuestN rewards.');
      }
    } catch (err: any) {
      console.error('External wallet connection error:', err);
      if (err.code === 4001 || err.message?.includes('rejected')) {
        toast.error('Connection cancelled');
      } else {
        toast.error(err.message || 'Failed to connect wallet');
      }
    } finally {
      setIsConnectingExternalWallet(false);
    }
  };
  useEffect(() => {
    if (user) {
      // 비동기 체크 (초기 렌더 시 빠른 클릭 레이스는 handleSubmit에서 재검증)
      void checkLightstickOwnership();
      checkFanEligibility();
      checkExternalWallet();
    } else {
      // 로그인하지 않은 경우 자격 확인을 위해 아티스트 제한 체크
      if (relatedWikiEntryIds.length > 0) {
        setIsFanEligible(false);
        setEligibleArtists(challenge.wiki_entries?.map(e => e.title) || [challenge.wiki_entry?.title || '']);
      }
    }
    checkParticipation();
    fetchParticipantCount();
  }, [user, challenge.id, relatedWikiEntryIds]);

  // YouTube 챌린지: target metric 확인 (viewCount, likeCount, commentCount)
  const youtubeTargetMetric = useMemo(() => {
    return challengeOptions?.youtube_target_metric || 'viewCount';
  }, [challengeOptions]);

  // YouTube 챌린지: 실시간 데이터 가져오기
  const fetchLiveMetricCount = async () => {
    if (!isYouTubeChallenge || !youtubeVideoId) return;
    setIsLoadingViews(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('get-youtube-views', {
        body: {
          videoId: youtubeVideoId
        }
      });
      if (!error && data) {
        // target metric에 따라 적절한 값 설정
        if (youtubeTargetMetric === 'likeCount' && data.likeCount !== null) {
          setLiveViewCount(data.likeCount);
        } else if (youtubeTargetMetric === 'commentCount' && data.commentCount !== null) {
          setLiveViewCount(data.commentCount);
        } else if (data.viewCount) {
          setLiveViewCount(data.viewCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live metric count:', err);
    } finally {
      setIsLoadingViews(false);
    }
  };

  // YouTube 챌린지: 1분마다 데이터 갱신
  useEffect(() => {
    if (!isYouTubeChallenge || !youtubeVideoId) return;

    // 초기 값 설정 (options에서 target metric에 맞는 값)
    const getInitialValue = () => {
      if (youtubeTargetMetric === 'likeCount') {
        return challengeOptions?.youtube_initial_likes;
      } else if (youtubeTargetMetric === 'commentCount') {
        return challengeOptions?.youtube_initial_comments;
      }
      return challengeOptions?.youtube_initial_views;
    };
    const initialValue = getInitialValue();
    if (initialValue && !liveViewCount) {
      setLiveViewCount(initialValue);
    }

    // 첫 로드 시 실시간 데이터 가져오기
    fetchLiveMetricCount();

    // 1분마다 갱신
    const interval = setInterval(fetchLiveMetricCount, 60000);
    return () => clearInterval(interval);
  }, [isYouTubeChallenge, youtubeVideoId, youtubeTargetMetric]);
  const checkLightstickOwnership = async (): Promise<boolean> => {
    if (!user) return false;

    // 응원봉(=Lightstick)은 특정 챌린지/아티스트가 아니라 "플랫폼의 활성 Fanz Token 보유 여부"로 판별한다.
    // - 사용자가 다른 아티스트 토큰을 들고 있어도 Lightstick holder로 간주해야 함
    // - 온체인 기준이 우선이며, 실패 시 DB로 폴백

    // DB fallback (온체인 체크 실패/지갑 미연결 케이스 대비)
    const fallbackToDb = async (): Promise<boolean> => {
      const {
        data,
        error
      } = await supabase.from('fanz_balances').select('balance').eq('user_id', user.id).gt('balance', 0).limit(1);
      if (error) return false;
      return !!data && data.length > 0;
    };
    try {
      // Edge Function은 walletAddress가 필수라, 유저의 지갑 1개를 기준으로 조회
      // - userId도 함께 넘기면 Edge Function이 wallet_addresses/EOA/SmartWallet 후보를 확장해서 "우리 지갑 + Base 지갑" 모두 커버한다.
      // - tokens는 Edge Function이 서버에서 활성 토큰 목록으로 자동 보완한다 (클라이언트 RLS 영향 제거)
      const {
        data: walletRows,
        error: walletErr
      } = await supabase.from('wallet_addresses').select('wallet_address, wallet_type').eq('user_id', user.id).limit(50);
      const walletAddress = walletRows?.find(w => w.wallet_type === 'smart_wallet')?.wallet_address || walletRows?.[0]?.wallet_address;

      // 지갑 정보가 없으면 DB 기준으로만 판단
      if (walletErr || !walletAddress) {
        const dbHas = await fallbackToDb();
        setHasLightstick(dbHas);
        return dbHas;
      }

      // 온체인 잔액 확인
      const {
        data: balanceData,
        error: balanceError
      } = await supabase.functions.invoke('get-user-fanz-balances', {
        body: {
          walletAddress,
          userId: user.id,
          includeMeta: false
        }
      });
      if (balanceError || !balanceData?.balances) {
        const dbHas = await fallbackToDb();
        setHasLightstick(dbHas);
        return dbHas;
      }
      const onchainHas = (balanceData.balances as Array<{
        balance: number;
      }>).some(t => Number((t as any).balance || 0) > 0);

      // 온체인 기준이 우선이지만,
      // 특정 토큰 목록 누락/메타데이터 불일치 등으로 온체인이 0으로 나오는 케이스가 있어
      // DB(fanz_balances)도 최종적으로 한 번 더 확인해서 보유자에게는 절대 모달이 뜨지 않게 한다.
      if (onchainHas) {
        setHasLightstick(true);
        return true;
      }
      const dbHas = await fallbackToDb();
      setHasLightstick(dbHas);
      return dbHas;
    } catch (err) {
      console.error('Error checking lightstick ownership:', err);
      const dbHas = await fallbackToDb();
      setHasLightstick(dbHas);
      return dbHas;
    }
  };

  // 팬 자격 확인 (팔로워 또는 토큰 보유)
  const checkFanEligibility = async () => {
    if (!user) return;

    // 아티스트 제한이 없으면 누구나 참여 가능
    if (relatedWikiEntryIds.length === 0) {
      setIsFanEligible(true);
      return;
    }

    // 1. 팔로워 확인
    const {
      data: followerData
    } = await supabase.from('wiki_entry_followers').select('wiki_entry_id').eq('user_id', user.id).in('wiki_entry_id', relatedWikiEntryIds).limit(1);
    if (followerData && followerData.length > 0) {
      setIsFanEligible(true);
      return;
    }

    // 2. 토큰 보유 확인
    const {
      data: tokenData
    } = await supabase.from('fanz_balances').select(`
        balance,
        fanz_tokens!inner(wiki_entry_id)
      `).eq('user_id', user.id).in('fanz_tokens.wiki_entry_id', relatedWikiEntryIds).gt('balance', 0).limit(1);
    if (tokenData && tokenData.length > 0) {
      setIsFanEligible(true);
      return;
    }

    // 자격 없음 - 관련 아티스트 이름 표시
    setIsFanEligible(false);
    const artistNames = challenge.wiki_entries?.map(e => e.title) || [];
    if (challenge.wiki_entry?.title && !artistNames.includes(challenge.wiki_entry.title)) {
      artistNames.unshift(challenge.wiki_entry.title);
    }
    setEligibleArtists(artistNames);
  };
  const checkParticipation = async () => {
    if (!user) return;

    // 중복 참여 지원: 모든 참여 내역 조회
    const {
      data
    } = await supabase.from('challenge_participations').select('answer, is_winner, prize_amount, claimed_at').eq('challenge_id', challenge.id).eq('user_id', user.id).order('created_at', {
      ascending: false
    });
    if (data && data.length > 0) {
      setHasParticipated(true);
      setUserAnswers(data.map(d => d.answer));
      // 당첨 여부는 당첨된 참여가 있는지 확인
      const winningEntry = data.find(d => d.is_winner);
      if (winningEntry) {
        setIsWinner(true);
        setPrizeAmount(winningEntry.prize_amount);
        setWinningAnswer(winningEntry.answer);

        // 등수 계산: 모든 위너 중에서 현재 사용자의 등수 찾기
        const {
          data: allWinners
        } = await supabase.from('challenge_participations').select('user_id, prize_amount, answer').eq('challenge_id', challenge.id).eq('is_winner', true).order('prize_amount', {
          ascending: false
        });
        if (allWinners) {
          // YouTube 챌린지인 경우 정답 근사치로 재정렬
          const isYouTube = challenge.question?.toLowerCase().includes('youtube') || challenge.question?.toLowerCase().includes('view');
          let sortedWinners = allWinners;
          if (isYouTube && challenge.correct_answer && !isNaN(Number(challenge.correct_answer))) {
            const targetValue = Number(challenge.correct_answer);
            sortedWinners = [...allWinners].sort((a, b) => {
              if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
                return (b.prize_amount || 0) - (a.prize_amount || 0);
              }
              const aDiff = Math.abs(Number(a.answer) - targetValue);
              const bDiff = Math.abs(Number(b.answer) - targetValue);
              if (isNaN(aDiff) && isNaN(bDiff)) return 0;
              if (isNaN(aDiff)) return 1;
              if (isNaN(bDiff)) return -1;
              return aDiff - bDiff;
            });
          }
          const rank = sortedWinners.findIndex(w => w.user_id === user.id) + 1;
          if (rank > 0) setWinnerRank(rank);
        }
      }
    }
  };
  const fetchParticipantCount = async () => {
    // 내부/외부 참가자 수와 목록을 병렬로 조회 (성능 최적화)
    const [internalCountRes, externalCountRes, internalDataRes, externalDataRes] = await Promise.all([supabase.from('challenge_participations').select('*', {
      count: 'exact',
      head: true
    }).eq('challenge_id', challenge.id), supabase.from('external_challenge_participations').select('*', {
      count: 'exact',
      head: true
    }).eq('challenge_id', challenge.id), supabase.from('challenge_participations').select('id, user_id, created_at, has_lightstick').eq('challenge_id', challenge.id).order('created_at', {
      ascending: false
    }).limit(20), supabase.from('external_challenge_participations').select('id, external_wallet_id, created_at, has_lightstick').eq('challenge_id', challenge.id).order('created_at', {
      ascending: false
    }).limit(20)]);
    const totalCount = (internalCountRes.count || 0) + (externalCountRes.count || 0);
    setParticipantCount(totalCount);
    const internalData = internalDataRes.data;
    const externalData = externalDataRes.data;

    // 프로필 조회도 병렬로 실행
    const internalUserIds = internalData?.map(p => p.user_id) || [];
    const externalWalletIds = externalData?.map(p => p.external_wallet_id) || [];
    const [profilesRes, externalUsersRes] = await Promise.all([internalUserIds.length > 0 ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', internalUserIds) : Promise.resolve({
      data: []
    }), externalWalletIds.length > 0 ? supabase.from('external_wallet_users_public').select('id, username, display_name, avatar_url, source').in('id', externalWalletIds) : Promise.resolve({
      data: []
    })]);
    const internalProfilesMap = new Map<string, any>((profilesRes.data || []).map((p: any) => [p.id, p]));
    const externalUsersMap = new Map<string, any>((externalUsersRes.data || []).map((u: any) => [u.id, u]));

    // 내부 + 외부 참가자 통합
    const internalParticipants = (internalData || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      created_at: p.created_at,
      has_lightstick: p.has_lightstick,
      profile: internalProfilesMap.get(p.user_id) || null,
      isExternal: false
    }));
    const externalParticipants = (externalData || []).map(p => {
      const extUser = externalUsersMap.get(p.external_wallet_id);
      return {
        id: p.id,
        user_id: p.external_wallet_id,
        created_at: p.created_at,
        has_lightstick: p.has_lightstick,
        profile: extUser ? {
          id: extUser.id,
          username: extUser.username || `farcaster:${extUser.id.slice(0, 6)}`,
          display_name: extUser.display_name,
          avatar_url: extUser.avatar_url
        } : null,
        isExternal: true,
        source: extUser?.source || 'external'
      };
    });

    // 시간순 정렬 후 20개 제한
    const allParticipants = [...internalParticipants, ...externalParticipants].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20) as Participant[];
    setParticipants(allParticipants);
  };

  // 위너 리스트 조회 (결과 발표 후)
  const fetchWinners = async () => {
    // 관리자 승인 후에만 위너 조회
    if (!challenge.admin_approved_at) return;
    setIsLoadingWinners(true);
    try {
      // 1. Internal 당첨자 조회
      const {
        data: internalData
      } = await supabase.from('challenge_participations').select('id, user_id, prize_amount, has_lightstick, answer, created_at').eq('challenge_id', challenge.id).eq('is_winner', true).order('prize_amount', {
        ascending: false
      });

      // 2. External 당첨자 조회 (Farcaster)
      const {
        data: externalData
      } = await supabase.from('external_challenge_participations').select('id, external_wallet_id, prize_amount, has_lightstick, answer, created_at').eq('challenge_id', challenge.id).eq('is_winner', true).order('prize_amount', {
        ascending: false
      });

      // External 프로필 조회
      const externalIds = (externalData || []).map(e => e.external_wallet_id);
      let externalProfilesMap = new Map<string, any>();
      if (externalIds.length > 0) {
        const {
          data: extProfiles
        } = await supabase.from('external_wallet_profiles_public').select('id, username, display_name, avatar_url').in('id', externalIds);
        externalProfilesMap = new Map((extProfiles || []).map(p => [p.id, p]));
      }

      // YouTube 챌린지인 경우 정답 근사치로 재정렬
      const isYouTube = challenge.question?.toLowerCase().includes('youtube') || challenge.question?.toLowerCase().includes('view');

      // Internal 정렬
      let sortedInternalData = internalData || [];
      if (isYouTube && challenge.correct_answer && !isNaN(Number(challenge.correct_answer))) {
        const targetValue = Number(challenge.correct_answer);
        sortedInternalData = [...sortedInternalData].sort((a, b) => {
          if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
            return (b.prize_amount || 0) - (a.prize_amount || 0);
          }
          const aDiff = Math.abs(Number(a.answer) - targetValue);
          const bDiff = Math.abs(Number(b.answer) - targetValue);
          if (isNaN(aDiff) && isNaN(bDiff)) return 0;
          if (isNaN(aDiff)) return 1;
          if (isNaN(bDiff)) return -1;
          return aDiff - bDiff;
        });
      }

      // user_id 기준으로 중복 제거
      // - 기본: prize_amount 높은 값 우선
      // - YouTube: prize_amount 동률이면 정답 근접도(차이) 작은 값 우선
      // - 마지막 tie-break: created_at 빠른 값 우선
      const uniqueInternalMap = new Map<string, typeof sortedInternalData[0]>();
      for (const w of sortedInternalData) {
        const existing = uniqueInternalMap.get(w.user_id);
        if (!existing) {
          uniqueInternalMap.set(w.user_id, w);
          continue;
        }
        const wPrize = w.prize_amount || 0;
        const ePrize = existing.prize_amount || 0;
        if (wPrize !== ePrize) {
          if (wPrize > ePrize) uniqueInternalMap.set(w.user_id, w);
          continue;
        }

        // prize_amount 동률
        if (isYouTube && challenge.correct_answer && !isNaN(Number(challenge.correct_answer))) {
          const targetValue = Number(challenge.correct_answer);
          const wDiff = Math.abs(Number(w.answer) - targetValue);
          const eDiff = Math.abs(Number(existing.answer) - targetValue);
          const wDiffSafe = Number.isFinite(wDiff) ? wDiff : Number.POSITIVE_INFINITY;
          const eDiffSafe = Number.isFinite(eDiff) ? eDiff : Number.POSITIVE_INFINITY;
          if (wDiffSafe !== eDiffSafe) {
            if (wDiffSafe < eDiffSafe) uniqueInternalMap.set(w.user_id, w);
            continue;
          }
        }

        // 마지막 tie-break: created_at
        const wTime = new Date(w.created_at).getTime();
        const eTime = new Date(existing.created_at).getTime();
        if (Number.isFinite(wTime) && Number.isFinite(eTime) && wTime < eTime) {
          uniqueInternalMap.set(w.user_id, w);
        }
      }
      const uniqueInternalWinners = Array.from(uniqueInternalMap.values());

      // Internal 프로필 조회
      const userIds = uniqueInternalWinners.map(w => w.user_id);
      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const {
          data: profiles
        } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds);
        profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      }

      // Internal 당첨자를 통합 형태로 변환
      const internalWinners = uniqueInternalWinners.map(w => ({
        ...w,
        profile: profilesMap.get(w.user_id) || null,
        source: 'internal' as const
      }));

      // External 당첨자를 통합 형태로 변환
      const externalWinners = (externalData || []).map(w => ({
        ...w,
        user_id: w.external_wallet_id,
        profile: externalProfilesMap.get(w.external_wallet_id) || null,
        source: 'external' as const
      }));

      // 통합 정렬: 어드민 발표 기준과 동일하게
      // - prize_amount 내림차순
      // - YouTube: 정답 근접도 오름차순
      // - tie-break: created_at 오름차순, 마지막 id
      let allWinners = [...internalWinners, ...externalWinners];
      if (isYouTube && challenge.correct_answer && !isNaN(Number(challenge.correct_answer))) {
        const targetValue = Number(challenge.correct_answer);
        allWinners = allWinners.sort((a, b) => {
          // 먼저 prize_amount로 정렬 (같은 등수 그룹)
          if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
            return (b.prize_amount || 0) - (a.prize_amount || 0);
          }
          // 같은 상금이면 정답 근접도로 정렬
          const aDiff = Math.abs(Number(a.answer) - targetValue);
          const bDiff = Math.abs(Number(b.answer) - targetValue);
          const aDiffSafe = Number.isFinite(aDiff) ? aDiff : Number.POSITIVE_INFINITY;
          const bDiffSafe = Number.isFinite(bDiff) ? bDiff : Number.POSITIVE_INFINITY;
          if (aDiffSafe !== bDiffSafe) return aDiffSafe - bDiffSafe;
          const aTime = new Date((a as any).created_at).getTime();
          const bTime = new Date((b as any).created_at).getTime();
          if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
          return String((a as any).id).localeCompare(String((b as any).id));
        });
      } else {
        allWinners = allWinners.sort((a, b) => (b.prize_amount || 0) - (a.prize_amount || 0)).sort((a, b) => {
          if ((b.prize_amount || 0) !== (a.prize_amount || 0)) {
            return (b.prize_amount || 0) - (a.prize_amount || 0);
          }
          const aTime = new Date((a as any).created_at).getTime();
          const bTime = new Date((b as any).created_at).getTime();
          if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
          return String((a as any).id).localeCompare(String((b as any).id));
        });
      }
      setWinners(allWinners);
    } catch (err) {
      console.error('Failed to fetch winners:', err);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  // 관리자 승인 후 위너 조회
  useEffect(() => {
    if (challenge.admin_approved_at) {
      fetchWinners();
    }
  }, [challenge.admin_approved_at]);
  const loadMoreParticipants = async () => {
    setIsLoadingMore(true);
    try {
      const {
        data: participantsData
      } = await supabase.from('challenge_participations').select('id, user_id, created_at, has_lightstick').eq('challenge_id', challenge.id).order('created_at', {
        ascending: false
      }).range(participants.length, participants.length + 19);
      if (participantsData && participantsData.length > 0) {
        const userIds = participantsData.map(p => p.user_id);
        const {
          data: profilesData
        } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const newParticipants = participantsData.map(p => ({
          id: p.id,
          user_id: p.user_id,
          created_at: p.created_at,
          has_lightstick: p.has_lightstick,
          profile: profilesMap.get(p.user_id) || null
        }));
        setParticipants(prev => [...prev, ...newParticipants]);
      }
    } catch (error) {
      console.error('Error loading more participants:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };
  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please login to participate');
      return;
    }

    // 팬 자격 확인
    if (!isFanEligible) {
      toast.error('Only fans of the eligible artists can participate');
      return;
    }
    const answer = isMultipleChoice ? selectedAnswer : customAnswer;
    if (!answer.trim()) {
      toast.error('Please select or enter an answer');
      return;
    }

    // 🚀 즉시 로딩 상태로 전환 (UX 개선)
    setIsSubmitting(true);
    try {
      // 응원봉 보유 여부는 이미 캐시된 값 사용 (느린 온체인 호출 제거)
      // hasLightstick은 컴포넌트 마운트 시 이미 체크됨
      const confirmedHasLightstick = hasLightstick;

      // 응원봉 미보유자에게 권유 모달 표시 (처음 제출 시)
      if (!confirmedHasLightstick && !showLightstickPromptDialog) {
        setIsSubmitting(false);
        setShowLightstickPromptDialog(true);
        return;
      }

      // 참여 비용 확인 (서버에서 차감)
      const entryCost = challenge.entry_cost || 0;
      if (entryCost > 0) {
        // 사용자 포인트 확인 (UI용)
        const {
          data: profile
        } = await supabase.from('profiles').select('available_points').eq('id', user.id).single();
        if (!profile || profile.available_points < entryCost) {
          setRequiredStars(entryCost);
          setShowInsufficientStarsDialog(true);
          setIsSubmitting(false);
          return;
        }
      }
      // Edge Function을 통해 참여 처리 (포인트 차감 + IP/Fingerprint rate limit 포함)
      const {
        data: result,
        error: participateError,
        response: participateResponse
      } = (await supabase.functions.invoke('participate-challenge', {
        body: {
          challengeId: challenge.id,
          answer: answer.trim(),
          hasLightstick: confirmedHasLightstick,
          fingerprint // fingerprint 전달 (서버에서 rate limit 체크용)
        }
      })) as any;

      // Rate limit 에러 처리:
      // - functions-js는 non-2xx를 data 대신 error(FunctionsHttpError)로 내려줌
      // - 환경/버전에 따라 error.context가 Response이거나 body string을 포함할 수 있어 둘 다 대응
      const status: number | undefined = participateResponse?.status ?? (participateError as any)?.context?.status ?? (participateError as any)?.context?.statusCode;
      let errorPayload: any = null;
      if (participateError) {
        const ctxBody = (participateError as any)?.context?.body;
        if (typeof ctxBody === 'string') {
          try {
            errorPayload = JSON.parse(ctxBody);
          } catch {
            // JSON 파싱 실패 시 무시
          }
        } else if (participateResponse?.clone) {
          try {
            errorPayload = await participateResponse.clone().json();
          } catch {
            // json 파싱 실패 시 무시
          }
        }
      }
      const participateErrorMessage = String(participateError?.message || '');
      
      // 유저 계정 기준 최대 참여 횟수 초과
      const maxEntriesReached = result?.code === 'MAX_ENTRIES_REACHED' || errorPayload?.code === 'MAX_ENTRIES_REACHED';
      if (maxEntriesReached) {
        toast.warning('You have reached the maximum of 3 entries for this challenge.', {
          duration: 5000
        });
        return;
      }
      
      const rateLimited = status === 429 || result?.code === 'RATE_LIMITED' || errorPayload?.code === 'RATE_LIMITED' || result?.error?.includes('Too many participation') || errorPayload?.error?.includes?.('Too many participation') || participateErrorMessage.includes('429') || participateErrorMessage.includes('RATE_LIMITED');
      if (rateLimited) {
        toast.warning('You can only participate 3 times per challenge every 24 hours. Please try again later.', {
          duration: 5000
        });
        return;
      }
      if (participateError) {
        throw new Error(errorPayload?.error || participateErrorMessage || 'Failed to participate');
      }
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to participate');
      }

      // 온체인 기록 (fire-and-forget: await 없이 백그라운드에서 실행, UI 블로킹 제거)
      supabase.functions.invoke('record-challenge-onchain', {
        body: {
          challengeId: challenge.id,
          answer: answer.trim(),
          hasLightstick,
          userId: user.id
        }
      }).then(({
        data: onchainResult,
        error: onchainError
      }) => {
        if (onchainError) {
          console.error('Onchain recording failed:', onchainError);
        } else if (onchainResult?.success) {
          console.log('Onchain recording success:', onchainResult.data);
        }
      }).catch(onchainErr => {
        console.error('Onchain recording error:', onchainErr);
      });

      // 확인 모달 닫기
      setShowConfirmDialog(false);
      toast.success(entryCost > 0 ? `Your answer has been submitted! (${entryCost} Stars used)` : 'Your answer has been submitted!');
      setHasParticipated(true);
      setUserAnswers(prev => [answer.trim(), ...prev]);
      setParticipantCount(prev => prev + 1);
      // 입력 필드 초기화 (추가 참여 가능)
      setSelectedAnswer('');
      setCustomAnswer('');
      // 참가자 목록 새로고침
      fetchParticipantCount();
      onParticipationComplete?.();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to participate';

      // Rate limit 에러인 경우 경고 토스트로 표시
      const isRateLimited = errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('RATE_LIMITED') || errorMessage.toLowerCase().includes('too many participation');
      if (isRateLimited) {
        toast.warning('You can only participate 3 times per challenge every 24 hours. Please try again later.', {
          duration: 5000
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // options에서 보기 옵션과 prize_tiers 분리
  const optionsData: ChallengeOptions | undefined = Array.isArray(challenge.options) ? undefined : challenge.options as ChallengeOptions;
  const prizeTiers: PrizeTier[] = optionsData?.prize_tiers || [];
  const choiceItems: MultipleChoiceItem[] = (() => {
    if (Array.isArray(challenge.options)) {
      // 레거시: string[]
      return challenge.options.map(text => ({
        id: text,
        text
      }));
    }
    if (Array.isArray(optionsData?.items) && optionsData.items.length > 0) {
      return optionsData.items;
    }

    // 레거시(과거 실험): choices: string[]
    if (Array.isArray(optionsData?.choices) && optionsData.choices.length > 0) {
      return optionsData.choices.map((text, idx) => ({
        id: text,
        label: String.fromCharCode(65 + idx),
        text
      }));
    }
    return [];
  })();

  // 선택지의 wiki_entry 정보 및 fanz_token 가격 조회
  useEffect(() => {
    const fetchChoiceWikiInfo = async () => {
      const wikiEntryIds = choiceItems.filter(item => item.wiki_entry_id).map(item => item.wiki_entry_id as string);
      if (wikiEntryIds.length === 0) return;

      // wiki_entries 정보 조회
      const {
        data: wikiData
      } = await supabase.from('wiki_entries').select('id, image_url, slug').in('id', wikiEntryIds);

      // fanz_tokens 정보 조회
      const {
        data: tokenData
      } = await supabase.from('fanz_tokens').select('id, wiki_entry_id, base_price, k_value, total_supply').in('wiki_entry_id', wikiEntryIds).eq('is_active', true);
      const infoMap: Record<string, any> = {};
      wikiData?.forEach(wiki => {
        infoMap[wiki.id] = {
          image_url: wiki.image_url,
          slug: wiki.slug,
          fanzToken: null,
          priceUsd: null
        };
      });
      tokenData?.forEach(token => {
        if (token.wiki_entry_id && infoMap[token.wiki_entry_id]) {
          // Bonding curve 가격 계산: P(s) = basePrice + k * (sqrt(s + 9) - 3)
          const basePrice = Number(token.base_price ?? 1.65);
          const kValue = Number(token.k_value ?? 2);
          const totalSupply = Number(token.total_supply ?? 0);
          const bondingPrice = basePrice + kValue * (Math.sqrt(totalSupply + 9) - 3);
          const priceUsd = bondingPrice * 1.10; // 10% 수수료 포함

          infoMap[token.wiki_entry_id].fanzToken = {
            id: token.id,
            base_price: basePrice,
            k_value: kValue,
            total_supply: totalSupply
          };
          infoMap[token.wiki_entry_id].priceUsd = priceUsd;
        }
      });
      setChoiceWikiInfo(infoMap);
    };
    fetchChoiceWikiInfo();
  }, [choiceItems.length]);
  const isMultipleChoice = choiceItems.length > 0;

  // 챌린지 시작 여부 확인
  const isStarted = new Date(challenge.start_time) <= new Date();

  // 챌린지 마감 여부 확인
  const isEnded = new Date(challenge.end_time) <= new Date();

  // 취소 가능 여부 (종료 3시간 전까지)
  const endTime = new Date(challenge.end_time).getTime();
  const threeHoursBeforeEnd = endTime - 3 * 60 * 60 * 1000;
  const canCancel = new Date().getTime() < threeHoursBeforeEnd;

  // 참여 취소 핸들러
  const handleCancel = async () => {
    if (!user || !hasParticipated) return;
    if (!canCancel) {
      toast.error('Cancellation is only allowed until 3 hours before the challenge ends');
      return;
    }
    setIsCancelling(true);
    try {
      // 참여 기록 삭제
      const {
        error: deleteError
      } = await supabase.from('challenge_participations').delete().eq('challenge_id', challenge.id).eq('user_id', user.id);
      if (deleteError) throw deleteError;

      // 스타 환불 (entry_cost가 있는 경우)
      const entryCost = challenge.entry_cost || 0;
      if (entryCost > 0) {
        const {
          data: currentProfile
        } = await supabase.from('profiles').select('available_points').eq('id', user.id).single();
        if (currentProfile) {
          await supabase.from('profiles').update({
            available_points: currentProfile.available_points + entryCost
          }).eq('id', user.id);

          // 환불 트랜잭션 기록
          await supabase.from('point_transactions').insert({
            user_id: user.id,
            action_type: 'challenge_refund',
            points: entryCost,
            reference_id: challenge.id
          });
        }
      }
      toast.success(entryCost > 0 ? `Participation cancelled. ${entryCost} Stars refunded!` : 'Participation cancelled successfully');
      setHasParticipated(false);
      setUserAnswers([]);
      setSelectedAnswer('');
      setCustomAnswer('');
      setParticipantCount(prev => Math.max(0, prev - 1));
      onParticipationComplete?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel participation');
    } finally {
      setIsCancelling(false);
    }
  };

  // 레거시 클레임 핸들러 제거됨 - 관리자 승인 시 자동으로 DB에 USDC 추가됨

  const getChoiceText = (item: MultipleChoiceItem) => item.wiki_entry_title || item.text || '';
  const wikiEntry = challenge.wiki_entry;
  const displayArtists = challenge.wiki_entries && challenge.wiki_entries.length > 0 ? challenge.wiki_entries : wikiEntry ? [wikiEntry] : [];

  // 서수 표시 함수
  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

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

    // 먼저 메트릭과 날짜를 찾아서 마커로 대체
    let processed = processedQuestion;
    const markers: {
      placeholder: string;
      text: string;
    }[] = [];

    // 메트릭 패턴 처리
    let matchIndex = 0;
    processed = processed.replace(metricPattern, match => {
      const placeholder = `__BOLD_METRIC_${matchIndex}__`;
      markers.push({
        placeholder,
        text: match
      });
      matchIndex++;
      return placeholder;
    });

    // 날짜/시간 패턴 처리
    processed = processed.replace(dateTimePattern, match => {
      const placeholder = `__BOLD_DATE_${matchIndex}__`;
      markers.push({
        placeholder,
        text: match
      });
      matchIndex++;
      return placeholder;
    });

    // 마커가 없으면 원본 반환
    if (markers.length === 0) {
      return processedQuestion;
    }

    // 마커를 기준으로 분할하고 JSX로 조합
    const parts: (string | JSX.Element)[] = [];
    let remaining = processed;
    markers.forEach(({
      placeholder,
      text
    }, idx) => {
      const splitIndex = remaining.indexOf(placeholder);
      if (splitIndex > 0) {
        parts.push(remaining.substring(0, splitIndex));
      }
      parts.push(<strong key={idx} className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-white">
          {text}
        </strong>);
      remaining = remaining.substring(splitIndex + placeholder.length);
    });
    if (remaining) {
      parts.push(remaining);
    }
    return <>{parts}</>;
  };

  // 질문 표시 (시작 전/후 모두 전체 보임) - 번역된 질문 사용
  const renderBlurredQuestion = () => {
    return formatQuestionWithBold(tQ('question'), challenge.answer_fetch_time);
  };
  return <Card className="overflow-hidden relative bg-white/10 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      {/* 배경 장식 요소 - 경량화 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-xl" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-xl" />
        <div className="absolute top-4 left-8 text-white/30 text-xs">✦</div>
        <div className="absolute top-8 right-12 text-purple-300/30 text-sm">✦</div>
      </div>
      
      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* 퀴즈쇼 뱃지 - 글래스모피즘 */}
            <Badge className="mb-3 bg-white/20 text-white border border-white/30 shadow-lg font-bold tracking-wide">
              <Trophy className="h-3 w-3 mr-1.5 text-amber-300" />
              {tQ('badge')}
            </Badge>
            
            {/* 질문 */}
            <div className="relative mb-4">
              <div className="absolute -inset-2 bg-white/5 rounded-xl blur-lg" />
              <CardTitle className="relative text-base sm:text-lg leading-relaxed text-white/90 drop-shadow-lg font-medium tracking-wide">
                {renderBlurredQuestion()}
              </CardTitle>
            </div>
          </div>
        </div>
        
        {/* 카운트다운 - 글래스 스타일 */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!isStarted ?
        // 시작 전: "Starting Soon" 카운트다운
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-full border border-amber-400/30">
              <Clock className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-amber-200 font-medium mr-1">{tQ('starts_in')}</span>
              <CountdownTimer endTime={challenge.start_time} />
            </div> :
        // 진행 중: 종료 카운트다운
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
              <Clock className="h-4 w-4 text-amber-300" />
              <CountdownTimer endTime={isYouTubeChallenge && challenge.answer_fetch_time ? challenge.answer_fetch_time : challenge.end_time} />
            </div>}
          {/* YouTube 챌린지: 정답 공개 시점 표시 */}
          {challenge.answer_fetch_time && isStarted && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
              <Trophy className="h-4 w-4 text-emerald-300" />
              <span className="text-sm text-white/80">
                {tQ('results')} {format(new Date(challenge.answer_fetch_time), 'MMM d, HH:mm')}
              </span>
            </div>}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-colors cursor-pointer">
                <Users className="h-4 w-4 text-purple-300" />
                <span className="text-sm text-white/80">{participantCount}</span>
              </button>
            </DialogTrigger>
            <DialogContent hideCloseButton className="inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-[360px] p-0 overflow-hidden rounded-2xl">
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 text-center rounded-t-2xl">
                <DialogTitle className="text-white text-base font-bold flex items-center justify-center gap-2">
                  <Users className="h-5 w-5" />
                  Participants ({participantCount})
                </DialogTitle>
              </div>
              
              {/* 리스트 */}
              <div className="overflow-y-auto max-h-[50vh] p-3 space-y-1.5">
                {participants.length > 0 ? <>
                    {participants.map(participant => {
                  const isExternal = (participant as any).isExternal;
                  const hasValidUsername = participant.profile?.username && !participant.profile.username.startsWith('farcaster:');
                  const content = <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors">
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={participant.profile?.avatar_url || ''} />
                            <AvatarFallback>
                              {participant.profile?.username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              @{participant.profile?.username || 'Anonymous'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(participant.created_at), 'MMM d, HH:mm')}
                            </p>
                          </div>
                        </div>;
                  return isExternal || !hasValidUsername ? <div key={participant.id}>{content}</div> : <Link key={participant.id} to={`/u/${participant.profile?.username}`} className="block">
                          {content}
                        </Link>;
                })}
                    {/* 더 보기 버튼 */}
                    {participants.length < participantCount && <Button variant="ghost" onClick={loadMoreParticipants} disabled={isLoadingMore} className="w-full text-xs h-8 text-muted-foreground">
                        {isLoadingMore ? <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Loading...
                          </> : <>Load more ({participantCount - participants.length} remaining)</>}
                      </Button>}
                  </> : <p className="text-center text-muted-foreground py-6 text-sm">
                    No participants yet
                  </p>}
              </div>
              
              {/* 닫기 버튼 */}
              <div className="p-3 pt-0">
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full text-sm h-9 border border-gray-300/50">
                    Close
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="relative pt-4 space-y-4 bg-white/5">
        {/* 참여 가능 팬 섹션 */}
        {displayArtists.length > 0 && <div className="bg-white/10 rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-300" />
              <span className="text-sm font-medium text-purple-200">Open to fans of</span>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-purple-300 hover:text-purple-200 transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-4">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600" />
                      Open to fans of
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Only users who are registered as <span className="font-semibold text-foreground">Fanz</span> on the fan pages listed below can participate in this challenge.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="font-medium text-foreground">How to become a Fanz:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Visit the fan page of the artist</li>
                        <li>Follow the fan page, OR</li>
                        <li>Purchase their Fanz Token</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayArtists.map(artist => <Link key={artist.id} to={`/k/${artist.slug || artist.id}`} className="flex items-center gap-2 bg-white/10 rounded-full px-2.5 py-1 border border-white/20 hover:border-purple-400 hover:bg-white/20 transition-all">
                  <Avatar className="h-6 w-6 border border-white/30">
                    <AvatarImage src={artist.image_url || ''} alt={artist.title} />
                    <AvatarFallback className="text-xs bg-purple-600 text-white">{artist.title[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-white/90 pr-1">{artist.title}</span>
                </Link>)}
            </div>
          </div>}
        
        {/* YouTube 영상 - 참여 여부와 관계없이 항상 표시 */}
        {isYouTubeUrl && youtubeVideoId && isStarted && isFanEligible && <div className="mb-4">
            <div className="relative rounded-xl overflow-hidden bg-black/20 border border-white/10">
              <div className="aspect-video">
                <iframe src={`https://www.youtube.com/embed/${youtubeVideoId}`} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
              </div>
            </div>
            
            {/* 현재 수치 표시 (target metric에 따라 다름) */}
            <div className="flex items-center justify-center gap-3 mt-3 px-3 py-2 bg-black/40 rounded-lg border border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white/60">
                  {youtubeTargetMetric === 'likeCount' ? 'Current Likes:' : youtubeTargetMetric === 'commentCount' ? 'Current Comments:' : 'Current Views:'}
                </span>
                {isLoadingViews && !liveViewCount ? <Loader2 className="h-4 w-4 animate-spin text-white/60" /> : <span className="text-lg font-bold text-amber-400">
                    {liveViewCount ? liveViewCount.toLocaleString() : (() => {
              if (youtubeTargetMetric === 'likeCount') return (challengeOptions?.youtube_initial_likes || 0).toLocaleString();
              if (youtubeTargetMetric === 'commentCount') return (challengeOptions?.youtube_initial_comments || 0).toLocaleString();
              return (challengeOptions?.youtube_initial_views || 0).toLocaleString();
            })()}
                  </span>}
              </div>
              {isLoadingViews && liveViewCount && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
            </div>
            
            <a href={youtubeUrl || `https://www.youtube.com/watch?v=${youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 mt-2 text-xs text-white/50 hover:text-white/70 transition-colors">
              <ExternalLink className="h-3 w-3" />
              Open in YouTube
            </a>
          </div>}

        {/* 이미 참여한 경우 - 마감 후이거나 결과 발표 시 */}
        {hasParticipated && (isEnded || challenge.selected_at) ? <div className="space-y-4">
            {/* 결과 발표 전: 제출 완료 상태만 표시 */}
            {!challenge.selected_at && <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 text-center border border-green-400/30">
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="font-medium text-green-300">You've submitted {userAnswers.length} answer{userAnswers.length > 1 ? 's' : ''}!</p>
                {/* 비객관식 답변 목록 표시 */}
                {!isMultipleChoice && userAnswers.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {userAnswers.slice(0, 5).map((ans, idx) => (
                      <div key={idx} className="flex items-center justify-center gap-2 text-sm">
                        <span className="text-white/40">#{userAnswers.length - idx}:</span>
                        <span className="text-white/80 font-medium">{Number(ans) ? Number(ans).toLocaleString() : ans}</span>
                      </div>
                    ))}
                    {userAnswers.length > 5 && <p className="text-[10px] text-white/40">+{userAnswers.length - 5} more</p>}
                  </div>
                )}
                <p className="text-xs text-white/50 mt-2">Winners will be announced after the challenge ends</p>
              </div>}
            
            {/* 보기 옵션 표시 (선택 불가) */}
            {isMultipleChoice && choiceItems.length > 0 && <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-200 flex items-center gap-2">
                  <span className="text-lg">🎯</span> Your answers ({userAnswers.length}):
                </Label>
                {choiceItems.map((item, idx) => {
            const displayText = getChoiceText(item);
            const wikiInfo = item.wiki_entry_id ? choiceWikiInfo[item.wiki_entry_id] : null;
            const isUserAnswer = userAnswers.includes(item.id);
            const isCorrect = challenge.correct_answer && item.id === challenge.correct_answer;
            return <div key={`${item.id}-${idx}`} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isUserAnswer ? isCorrect ? 'bg-green-500/20 border-green-400/50' : challenge.selected_at ? 'bg-red-500/20 border-red-400/50' : 'bg-green-500/20 border-green-400/50' : isCorrect && challenge.selected_at ? 'bg-green-500/10 border-green-400/30' : 'bg-white/5 border-white/10 opacity-60'}`}>
                      {/* 선택 여부 표시 */}
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isUserAnswer ? isCorrect || !challenge.selected_at ? 'border-green-400 bg-green-400' : 'border-red-400 bg-red-400' : isCorrect && challenge.selected_at ? 'border-green-400' : 'border-white/30'}`}>
                        {isUserAnswer && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      
                      {/* 썸네일 이미지 */}
                      {(wikiInfo?.image_url || item.wiki_entry_id) && <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-white/20 bg-white/10 shadow-lg">
                          {wikiInfo?.image_url ? <img src={wikiInfo.image_url} alt={displayText} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm text-white/50 font-bold">{displayText[0]}</div>}
                        </div>}
                      
                      <span className={`flex-1 font-semibold ${isUserAnswer ? 'text-white' : 'text-white/70'}`}>
                        {displayText}
                      </span>
                      
                      {isUserAnswer && <span className={`text-xs font-medium ${isCorrect || !challenge.selected_at ? 'text-green-400' : 'text-red-400'}`}>
                          Your pick
                        </span>}
                      {isCorrect && challenge.selected_at && !isUserAnswer && <span className="text-xs text-green-400 font-medium">Correct</span>}
                    </div>;
          })}
              </div>}
          </div> : <>

            
            {/* 참여 현황 배지 (마감 전) */}
            {hasParticipated && !isEnded && <div className="space-y-3 mb-4">
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-3 border border-green-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <span className="text-green-300 text-sm font-medium">
                      You've submitted {userAnswers.length} answer{userAnswers.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* 제출한 답변 목록 */}
                  <div className="ml-7 space-y-1 mb-2">
                    {userAnswers.slice(0, 5).map((ans, idx) => <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-white/40">#{userAnswers.length - idx}:</span>
                        <span className="text-white/70 truncate">{ans}</span>
                      </div>)}
                    {userAnswers.length > 5 && <p className="text-[10px] text-white/40">+{userAnswers.length - 5} more</p>}
                  </div>
                  <p className="text-xs text-white/50 ml-7">You can submit more answers below</p>
                </div>
              </div>}
            
            {/* 답변 입력 - 글래스모피즘 */}
            {!isStarted ? <div className="bg-white/10 rounded-xl p-4 text-center border border-white/20">
                <Clock className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                <p className="font-medium text-blue-200">Challenge hasn't started yet</p>
                <p className="text-sm text-white/70 mt-1">
                  Starts: {format(new Date(challenge.start_time), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-xs text-white/50 mt-2">
                  Come back when the challenge begins!
                </p>
              </div> : !isFanEligible ? <div className="bg-amber-500/10 rounded-xl p-4 text-center border border-amber-400/20">
                <Users className="h-8 w-8 text-amber-300 mx-auto mb-2" />
                <p className="font-medium text-amber-200">Fans Only Challenge</p>
                <p className="text-sm text-white/70 mt-1">
                  Only fans of {eligibleArtists.join(', ')} can participate.
                </p>
                <p className="text-xs text-white/50 mt-2">
                  Follow or hold their Fanz Token to participate!
                </p>
              </div> : <>
                {isMultipleChoice ? <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-purple-200 flex items-center gap-2 tracking-wide">
                    <span className="text-lg">🎯</span> Select your answer:
                  </Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/10">
                        <Info className="h-4 w-4 mr-1" />
                        Rules
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <HelpCircle className="h-5 w-5 text-purple-600" />
                          Challenge Rules
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <div className="space-y-2">
                          <h4 className="font-semibold">How to Win</h4>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Submit the correct answer before the deadline</li>
                            <li>Winners are randomly selected from correct answers</li>
                            <li>Prizes are distributed automatically after results</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold flex items-center gap-1.5">
                            <Wand2 className="h-4 w-4 text-amber-500" />
                            Lightstick Bonus
                          </h4>
                          <p className="text-muted-foreground">
                            If you hold a Fanz Token (Lightstick) of any eligible artist, 
                            you'll receive a larger share of the prize pool if you win!
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">Eligibility</h4>
                          <p className="text-muted-foreground">
                            Only fans (followers or token holders) of the specified artists 
                            can participate in challenges that require fan status.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">Cancellation</h4>
                          <p className="text-muted-foreground">
                            You can cancel your participation until 3 hours before the challenge ends.
                            Entry fees will be fully refunded upon cancellation.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                  {choiceItems.map((item, idx) => {
                const optionId = `option-${challenge.id}-${idx}`;
                // 1st, 2nd 라벨 제거 - 아티스트 이름만 표시
                const displayText = getChoiceText(item);
                const wikiInfo = item.wiki_entry_id ? choiceWikiInfo[item.wiki_entry_id] : null;
                const isSelected = selectedAnswer === item.id;
                return <div key={`${item.id}-${idx}`} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${isSelected ? 'bg-amber-500/30 border-amber-400/60 shadow-lg shadow-amber-500/20' : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-purple-400/40'}`}>
                        <RadioGroupItem value={item.id} id={optionId} className={`shrink-0 ${isSelected ? 'border-amber-300 text-amber-300' : 'border-white/40 text-purple-300'}`} />
                        
                        {/* 썸네일 이미지 - 사각형 */}
                        {(wikiInfo?.image_url || item.wiki_entry_id) && <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-white/20 bg-white/10 shadow-lg group-hover:scale-105 transition-transform">
                            {wikiInfo?.image_url ? <img src={wikiInfo.image_url} alt={displayText} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm text-white/50 font-bold">{displayText[0]}</div>}
                          </div>}
                        
                        <Label htmlFor={optionId} className={`flex-1 cursor-pointer font-semibold transition-colors ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                          {displayText}
                        </Label>
                        
                        {/* 응원봉 가격 및 구매 버튼 - 글래스 스타일 */}
                        {item.wiki_entry_id && <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-amber-400/50" onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (wikiInfo?.fanzToken) {
                      // 온체인 buyCost 계산: basePrice / 0.7 (V3)
                      const basePrice = wikiInfo.fanzToken.base_price;
                      const onchainBuyCost = basePrice / 0.7;
                      setSelectedTokenForBuy({
                        id: wikiInfo.fanzToken.id,
                        onchainBuyCostUsd: onchainBuyCost,
                        supply: wikiInfo.fanzToken.total_supply
                      });
                      setBuyDialogOpen(true);
                    } else {
                      toast.info('Lightstick not available yet for this artist');
                    }
                  }}>
                            <Wand2 className="h-3.5 w-3.5 text-amber-300" />
                            ${(wikiInfo?.priceUsd || 0).toFixed(2)}
                          </Button>}
                      </div>;
              })}
                </RadioGroup>
              </div> : <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-white">
                    {hasParticipated ? 'Submit another answer:' : 'Enter your answer:'}
                  </Label>
                  <span className="text-[10px] text-white/50">Up to 3 entries</span>
                </div>
                {isYouTubeChallenge ? <Input type="text" inputMode="numeric" pattern="[0-9]*" value={customAnswer ? Number(customAnswer.replace(/,/g, '')).toLocaleString() : ''} onChange={e => {
              // 숫자만 추출하여 저장 (콤마 제거)
              const rawValue = e.target.value.replace(/[^0-9]/g, '');
              setCustomAnswer(rawValue);
            }} placeholder="Enter view count (e.g., 1,234,567)" className="h-12 bg-white/10 border-white/60 text-white placeholder:text-white/40 focus:border-white" /> : <Input value={customAnswer} onChange={e => setCustomAnswer(e.target.value)} placeholder="Type your answer here..." className="h-12 bg-white/10 border-white/60 text-white placeholder:text-white/40 focus:border-white" />}
              </div>}
              </>}
            
            {/* 제출 버튼 - 시작 전이면 숨김 */}
            {isStarted && <div className="py-4">
                {/* 비로그인 상태: 두 가지 로그인 옵션 표시 */}
                {!user ? <div className="space-y-3">
                    <p className="text-center text-sm text-white/70 mb-2">
                      Sign in to participate
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button onClick={async () => {
                        await supabase.auth.signInWithOAuth({
                          provider: 'google',
                          options: { redirectTo: `${window.location.origin}/challenges` }
                        });
                      }} className="h-12 text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-amber-500/30 border-0 rounded-full">
                        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Continue with Google
                      </Button>
                      <Button onClick={() => signInWithWallet()} disabled={isWalletProcessing} className="h-12 text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 border-0 rounded-full">
                        {isWalletProcessing ? <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </> : <>
                            <svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 rounded-full">
                              <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF" />
                              <path d="M55.3646 92.5C75.3646 92.5 91.3646 76.5 91.3646 56.5C91.3646 36.5 75.3646 20.5 55.3646 20.5C36.5646 20.5 21.3646 34.7 19.5646 52.9H67.3646V60.1H19.5646C21.3646 78.3 36.5646 92.5 55.3646 92.5Z" fill="white" />
                            </svg>
                            Start with <span className="font-black">Base</span> Wallet
                          </>}
                      </Button>
                    </div>
                    <p className="text-center text-[10px] text-white/40">
                      Use your Base wallet for instant sign-up
                    </p>
                  </div> : <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogTrigger asChild>
                      <Button disabled={isSubmitting || !isFanEligible || userAnswers.length >= 3 || !(isMultipleChoice ? selectedAnswer : customAnswer.trim())} className="w-full h-14 text-base bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-amber-500/30 border-0">
                        {userAnswers.length >= 3 ? '✅ Max entries reached (3/3)' : <>🎯 Submit Answer{userAnswers.length > 0 && ` (${userAnswers.length}/3)`}{(challenge.entry_cost || 0) > 0 && <span className="ml-2 flex items-center gap-1">
                            <span className="font-normal opacity-80">×</span>
                            <Star className="h-4 w-4" />
                            <span>{challenge.entry_cost}</span>
                          </span>}</>}
                      </Button>
                    </DialogTrigger>
                    <DialogContent hideCloseButton className="inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-[320px] sm:max-w-[400px] max-h-[85vh] p-0 overflow-hidden rounded-2xl">
                      {/* 헤더 */}
                      <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 p-3 sm:p-4 text-center">
                        <span className="text-2xl sm:text-3xl">🎯</span>
                        <DialogTitle className="text-white text-base sm:text-lg font-bold mt-0.5">Ready to Submit?</DialogTitle>
                      </div>
                      
                      <div className="p-4 space-y-2.5">
                        {/* Your Answer - 메인 강조 */}
                        <div className="bg-gradient-to-br from-primary/5 to-primary/15 border-2 border-primary/50 rounded-xl p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Your Pick</p>
                          <p className="font-bold text-base sm:text-lg text-primary leading-tight">
                            {isMultipleChoice ? choiceItems.find(item => item.id === selectedAnswer)?.wiki_entry_title || choiceItems.find(item => item.id === selectedAnswer)?.text || selectedAnswer : customAnswer}
                          </p>
                        </div>
                        
                        {/* 응원봉 보유/미보유 */}
                        {hasLightstick ? <div className="flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-full py-1.5 px-3">
                            <span className="text-base">✨</span>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                              Lightstick Bonus: <span className="font-bold">${challenge.prize_with_lightstick}</span>
                            </span>
                          </div> : <p className="text-[11px] text-center text-purple-600 dark:text-purple-400">
                            💡 Get a Lightstick for <span className="font-bold">${challenge.prize_with_lightstick}</span> prize!
                          </p>}
                        
                        {/* 하단 안내 */}
                        <p className="text-[10px] text-center text-muted-foreground">
                          30 days to claim • Final answer
                        </p>
                      </div>
                      
                      {/* 버튼 영역 또는 로딩 상태 */}
                      {isSubmitting ? <div className="px-4 pb-6 pt-2 flex flex-col items-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="font-semibold text-sm">Recording on Blockchain...</p>
                            <p className="text-[11px] text-muted-foreground">Your answer is being securely registered</p>
                          </div>
                        </div> : <div className="px-4 pb-4 flex flex-col gap-1.5">
                          {(challenge.entry_cost || 0) > 0 && <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1 mb-0.5">
                              <span className="opacity-70">×</span>
                              <Star className="h-3 w-3 text-amber-400" />
                              <span>{challenge.entry_cost} Stars will be deducted</span>
                            </p>}
                          <Button onClick={() => {
                  handleSubmit();
                }} disabled={isSubmitting} className="w-full h-11 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-600 hover:via-orange-600 hover:to-pink-600 text-white font-bold text-sm shadow-lg">
                            🚀 Let's Go!
                          </Button>
                          <Button variant="ghost" onClick={() => setShowConfirmDialog(false)} className="text-muted-foreground text-xs h-8">
                            Maybe Later
                          </Button>
                        </div>}
                    </DialogContent>
                  </Dialog>}
              </div>}
            
          </>}
        
        {/* 🎉 내가 위너인 경우 화려하게 표시 (관리자 승인 후) */}
        {isWinner && challenge.admin_approved_at && <div className="mt-4 relative overflow-hidden">
            {/* 배경 글로우 효과 */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 blur-xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent" />
            
            <div className="relative bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 border-2 border-amber-400/50 rounded-2xl p-4">
              {/* 장식 */}
              <div className="absolute top-2 left-3 text-amber-300">✨</div>
              <div className="absolute top-3 right-4 text-yellow-300">⭐</div>
              
              {/* KTRENDZ 로고 */}
              <div className="absolute top-2 right-2 text-[10px] font-bold text-amber-400/60">
                KTRENDZ
              </div>
              
              {/* 메인 콘텐츠 */}
              <div className="text-center space-y-3">
                {/* 트로피 + 축하 메시지 */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl">🏆</span>
                  <h3 className="text-xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)]">
                    You Won!
                  </h3>
                  <span className="text-3xl">🎉</span>
                </div>
                
                {/* 등수 뱃지 */}
                {winnerRank && <div className="flex justify-center">
                    <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm shadow-lg ${winnerRank === 1 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900' : winnerRank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800' : winnerRank === 3 ? 'bg-gradient-to-r from-orange-400 to-amber-600 text-orange-900' : 'bg-gradient-to-r from-purple-400 to-pink-500 text-white'}`}>
                      {winnerRank === 1 && <span>🥇</span>}
                      {winnerRank === 2 && <span>🥈</span>}
                      {winnerRank === 3 && <span>🥉</span>}
                      {winnerRank > 3 && <span>#{winnerRank}</span>}
                      {winnerRank <= 3 ? `${winnerRank}${winnerRank === 1 ? 'st' : winnerRank === 2 ? 'nd' : 'rd'} Place` : 'Winner'}
                    </div>
                  </div>}
                
                {/* 정보 그리드 */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {/* 제출한 답변 */}
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Your Answer</p>
                    <p className="text-sm font-semibold text-white truncate" title={winningAnswer || ''}>
                      {winningAnswer || userAnswers[0] || '-'}
                    </p>
                  </div>
                  
                  {/* 우승 상금 */}
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-3 border border-green-400/30">
                    <p className="text-[10px] uppercase tracking-wider text-green-300/70 mb-1">Prize Won</p>
                    <p className="text-lg font-black text-green-400 flex items-center justify-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {prizeAmount?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                
                {/* 응원봉 보너스 표시 */}
                {hasLightstick && <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300/80">
                    <span>🪄</span>
                    <span>Lightstick Bonus Applied!</span>
                  </div>}
                
                {/* 클레임 안내 */}
                <p className="text-[10px] text-white/40 pt-2">
                  Prize has been added to your USDC balance • Withdraw from Earn page
                </p>
                
                {/* 자랑하기 버튼 */}
                <div className="pt-2">
                  <Button size="sm" onClick={handleShareWin} className="bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-600 hover:to-orange-600 text-white border-0 rounded-full px-4 shadow-lg shadow-amber-900/40">
                    {isCopied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                    {isCopied ? 'Copied!' : 'Share Your Victory'}
                  </Button>
                </div>
              </div>
            </div>
          </div>}
        
        {/* 참여했지만 위너가 아닌 경우 */}
        {hasParticipated && !isWinner && challenge.selected_at && <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-lg">😢</span>
              <div>
                <p className="text-sm font-medium">Better luck next time!</p>
                <p className="text-xs text-white/40">
                  Your answer: <span className="text-white/60">{userAnswers[0]}</span>
                </p>
              </div>
            </div>
          </div>}
        
        {/* 위너 리스트 (항상 표시) */}
        <div className="mt-4 pt-3 border-t border-amber-400/30">
          <div className="space-y-2 mb-3">
            {/* 첫 번째 줄: 타이틀과 도움말 */}
            <div className="flex items-center gap-2">
              
              <p className="font-bold text-amber-300 text-lg">
                {challenge.admin_approved_at ? '🎉 Winners Announced!' : isEnded ? '⏳ Awaiting Results...' : '🏆 Winners'}
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-0.5 rounded-full hover:bg-white/10 transition-colors">
                    <HelpCircle className="h-4 w-4 text-white/50 hover:text-white/80" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-gray-900 border-white/10 text-white p-4" side="bottom" align="start">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <Wand2 className="h-4 w-4 text-amber-400" />
                    Winner Selection Logic
                  </h4>
                  <div className="space-y-2 text-xs text-white/70">
                    <p>
                      <span className="font-medium text-white/90">🪄 7:3 Ratio:</span> 70% of winners are selected from Lightstick holders, 30% from non-holders.
                    </p>
                    <p>
                      <span className="font-medium text-white/90">🎯 Selection:</span> For view predictions, closest answers win. For quizzes, correct answers are randomly selected.
                    </p>
                    <p>
                      <span className="font-medium text-white/90">🔗 On-chain Verification:</span> Winner selection uses blockchain randomness for transparency.
                    </p>
                    <p className="text-[10px] text-white/50 pt-1 border-t border-white/10">
                      Tip: Hold a Lightstick to increase your winning chances!
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* 위너 수 배지 */}
            <div className="flex items-center justify-end">
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                {winners.length} Winners
              </Badge>
            </div>
          </div>
          
          {/* 정답 표시 영역 - 객관식은 end_time 후 정답 공개, YouTube는 answer_fetch_time 후 공개 */}
          {(() => {
          const isMultipleChoice = challengeOptions?.type === 'multiple_choice';
          const isYoutubeType = challengeOptions?.type === 'youtube';
          // 객관식: end_time 지나면 정답 공개, YouTube: answer_fetch_time 지나고 correct_answer 있으면 공개
          const shouldShowAnswer = isMultipleChoice ? isEnded && challenge.correct_answer : challenge.correct_answer && (challenge.admin_approved_at || isYoutubeType && challenge.answer_fetch_time && new Date(challenge.answer_fetch_time) <= new Date());
          return <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg border ${shouldShowAnswer ? 'bg-green-500/10 border-green-500/20' : isEnded && !challenge.answer_fetch_time && !isMultipleChoice ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/10'}`}>
                {shouldShowAnswer ? <>
                    <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    <span className="text-xs text-green-400/70">Answer:</span>
                    <span className="text-sm font-medium text-green-300 truncate">{challenge.correct_answer}</span>
                  </> : isEnded && isYoutubeType && !challenge.correct_answer ? <>
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                    <span className="text-xs text-blue-300">Fetching YouTube data...</span>
                  </> : challenge.selected_at && !challenge.admin_approved_at ? <>
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-300">{tQ('results_pending')}</span>
                  </> : <>
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/20 text-amber-400 shrink-0">
                      <span className="text-sm font-bold">?</span>
                    </div>
                    <span className="text-xs text-white/50">Answer will be revealed after the challenge ends</span>
                  </>}
              </div>;
        })()}
          
          {/* 위너 리스트 */}
          {isLoadingWinners ? <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
            </div> : winners.length > 0 ? <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {winners.map((winner, idx) => {
            const isExternal = (winner as any).source === 'external';
            const content = <div className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 transition-colors border border-amber-500/10">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    {isExternal && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" title="Farcaster" />}
                    <Avatar className="h-7 w-7 bg-white">
                      <AvatarImage src={winner.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-[9px] bg-white text-gray-600">
                        {winner.profile?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/90 truncate">
                        {winner.profile?.display_name || winner.profile?.username || 'Anonymous'}
                      </p>
                      <p className="text-[10px] text-white/50 truncate">{winner.answer}</p>
                    </div>
                    {winner.has_lightstick && <span className="text-base shrink-0" title="Lightstick Holder">🪄</span>}
                    {winner.prize_amount && <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1.5 shrink-0">
                        ${winner.prize_amount}
                      </Badge>}
                  </div>;

            // External 당첨자는 프로필 링크 없음
            if (isExternal || !winner.profile?.username) {
              return <div key={winner.id}>{content}</div>;
            }
            return <Link key={winner.id} to={`/u/${winner.profile.username}`}>
                    {content}
                  </Link>;
          })}
            </div> : <div className="text-center py-16 text-white/70">
              <Trophy className="h-8 w-8 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-medium">
                {isEnded ? 'Awaiting Results...' : 'Winners will be announced here'}
              </p>
              {isEnded && challenge.answer_fetch_time && (
                <p className="text-xs text-white mt-1">
                  📋 {tQ('results_at')}: {format(new Date(challenge.answer_fetch_time), 'MMM d, h:mm a')}
                </p>
              )}
              {!isEnded && <p className="text-sm text-white mt-2 font-medium">
                ⏰ Ends: {format(new Date(challenge.end_time), 'MMM d, h:mm a')}
              </p>}
            </div>}
          
          {/* On-chain 링크 - 섹션 하단 우측 */}
          {(challenge.selection_tx_hash || challenge.onchain_challenge_id) && <div className="flex justify-end mt-3">
              <a href={challenge.selection_tx_hash ? `https://basescan.org/tx/${challenge.selection_tx_hash}` : `https://basescan.org/address/0xdE5eDb6A6A10F1ae91C4ed33bd640D0667a650Da`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                <ExternalLink className="h-3 w-3" />
                View on-chain verification
              </a>
            </div>}
        </div>
        
        {/* 최근 참가자 미리보기 - admin 승인 전에만 표시 */}
        {!challenge.admin_approved_at && participants.length > 0 && <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-semibold text-white">{tQ('recent_participants')}</p>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-sm font-medium transition-colors text-white/80 hover:text-white">
                    {tQ('view_all')} ({participantCount})
                  </button>
                </DialogTrigger>
                <DialogContent hideCloseButton className="inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-[360px] p-0 overflow-hidden rounded-2xl">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 text-center rounded-t-2xl">
                    <DialogTitle className="text-white text-base font-bold flex items-center justify-center gap-2">
                      <Users className="h-5 w-5" />
                      Participants ({participantCount})
                    </DialogTitle>
                  </div>
                  <div className="overflow-y-auto max-h-[50vh] p-3 space-y-1.5">
                    {groupedParticipants.map(participant => {
                  const isExternal = (participant as any).isExternal;
                  const source = (participant as any).source;
                  const content = <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors">
                          <Avatar className="h-8 w-8 bg-white">
                            <AvatarImage src={participant.profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-white text-gray-600">
                              {participant.profile?.username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1">
                              {participant.profile?.display_name || participant.profile?.username || 'Anonymous'}
                              {isExternal && source === 'farcaster' && <span className="text-purple-500 text-xs" title="Farcaster">🟣</span>}
                              {participant.count > 1 && <span className="ml-1.5 text-xs text-muted-foreground/60">x{participant.count}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(participant.created_at), 'MMM d, HH:mm')}
                            </p>
                          </div>
                          {participant.has_lightstick && <span className="text-lg" title="Lightstick Holder">🪄</span>}
                        </div>;
                  const hasValidUsername = participant.profile?.username && !participant.profile.username.startsWith('farcaster:');
                  return isExternal || !hasValidUsername ? <div key={participant.user_id}>{content}</div> : <Link key={participant.user_id} to={`/u/${participant.profile?.username}`}>
                          {content}
                        </Link>;
                })}
                    {participants.length < participantCount && <Button variant="ghost" onClick={loadMoreParticipants} disabled={isLoadingMore} className="w-full text-xs h-8 text-muted-foreground">
                        {isLoadingMore ? <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Loading...
                          </> : <>Load more ({participantCount - participants.length} remaining)</>}
                      </Button>}
                  </div>
                  <div className="p-3 pt-0">
                    <DialogClose asChild>
                      <Button variant="ghost" className="w-full text-sm h-9 border border-gray-300/50">
                        Close
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {/* 최근 참가자 20명 세로 리스트 */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {groupedParticipants.slice(0, 20).map(participant => {
            const isExternal = (participant as any).isExternal;
            const source = (participant as any).source;
            const content = <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Avatar className="h-9 w-9 bg-white">
                      <AvatarImage src={participant.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-white text-gray-600">
                        {participant.profile?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white/90 truncate flex items-center gap-1">
                        {participant.profile?.display_name || participant.profile?.username || 'Anonymous'}
                        {isExternal && source === 'farcaster' && <span className="text-purple-400 text-xs" title="Farcaster">🟣</span>}
                        {participant.count > 1 && <span className="ml-1 text-white/50">x{participant.count}</span>}
                      </span>
                      <span className="text-xs text-white/40 block">
                        {format(new Date(participant.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    {participant.has_lightstick && <span className="text-lg" title="Lightstick Holder">🪄</span>}
                  </div>;
            const hasValidUsername = participant.profile?.username && !participant.profile.username.startsWith('farcaster:');
            return isExternal || !hasValidUsername ? <div key={participant.user_id}>{content}</div> : <Link key={participant.user_id} to={`/u/${participant.profile?.username}`}>
                    {content}
                  </Link>;
          })}
            </div>
          </div>}
        
        {/* 마감 시간 - 결과 발표 전에만 표시 */}
        {!challenge.selected_at && <div className="flex items-center justify-between text-xs text-white pt-3 border-t border-white/10 gap-2">
            <span className="font-medium whitespace-nowrap">⏰ {tQ('ends')}: {format(new Date(challenge.end_time), 'M/d h:mm a')}</span>
            <span className="font-medium whitespace-nowrap">{tQ('results_within')}</span>
          </div>}
        
        {/* 하단 네온 라인 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
      </CardContent>
      
      {/* 트위터 팔로우 안내 - 카드 하단 (참여 후 마감 전에만 표시) */}
      {hasParticipated && !isEnded && <div className="mx-4 mt-4 mb-4 bg-sky-500/10 border border-sky-400/30 rounded-xl p-3 text-center">
          <p className="text-xs text-sky-300 mb-2">
            📢 Follow us for winner announcements!
          </p>
          <a href="https://twitter.com/intent/follow?screen_name=KTRNZ2025" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm rounded-full transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow @KTRNZ2025
          </a>
        </div>}
      
      {/* QuestN 지갑 연결 링크 - 현재 진행중인 캠페인 없어서 숨김 */}
      {/* {hasParticipated && user && (
        <div className="px-4 mb-2 text-center">
          {!hasExternalWallet ? (
            <button
              onClick={connectExternalWallet}
              disabled={isConnectingExternalWallet}
              className="text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              {isConnectingExternalWallet ? (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Using QuestN? Link wallet →'
              )}
            </button>
          ) : (
            <span className="text-[11px] text-green-400/70 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              QuestN wallet linked ({externalWalletAddress?.slice(0, 4)}...{externalWalletAddress?.slice(-3)})
            </span>
          )}
        </div>
       )} */}
      
      {/* 법적 고지 */}
      <div className="px-4 pt-3 pb-4 text-center">
        <p className="text-xs text-white/40">
          No purchase necessary, void where prohibited.
        </p>
      </div>
      
      {/* 응원봉 구매 다이얼로그 */}
      {selectedTokenForBuy && <BuyFanzTokenDialog open={buyDialogOpen} onOpenChange={open => {
      setBuyDialogOpen(open);
      if (!open) setSelectedTokenForBuy(null);
    }} tokenId={selectedTokenForBuy.id} onchainBuyCostUsd={selectedTokenForBuy.onchainBuyCostUsd} currentSupply={selectedTokenForBuy.supply} onPurchaseSuccess={() => {
      setBuyDialogOpen(false);
      setSelectedTokenForBuy(null);
      checkLightstickOwnership();
    }} />}

      {/* Stars 부족 다이얼로그 */}
      <Dialog open={showInsufficientStarsDialog} onOpenChange={setShowInsufficientStarsDialog}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[400px] mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-amber-400" />
              Not Enough Stars
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm">
              You need <span className="font-bold text-amber-400">{requiredStars} Stars</span> to participate in this challenge.
            </p>
            <p className="text-muted-foreground text-sm">
              Invite your friends to earn <span className="font-bold text-amber-400">50 Stars</span> for each friend who joins!
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold">
                <Link to="/profile?tab=invitations" onClick={() => setShowInsufficientStarsDialog(false)}>
                  <Gift className="h-4 w-4 mr-2" />
                  Get 50 Stars
                </Link>
              </Button>
              <Button variant="outline" className="w-full rounded-full" onClick={() => setShowInsufficientStarsDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 응원봉 미보유자 권유 다이얼로그 */}
      <Dialog open={showLightstickPromptDialog} onOpenChange={setShowLightstickPromptDialog}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[420px] mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wand2 className="h-5 w-5 text-purple-400" />
              Wait! Are You a True Fan?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Support your favorite artist and participate as a{' '}
              <span className="font-bold text-purple-400">Lightstick Holder</span> to win up to{' '}
              <span className="font-bold text-green-400">
                ${(() => {
                // prize_tiers에서 1등 응원봉 보유 상금 가져오기
                const tier1 = prizeTiers.find(t => t.rank === 1);
                if (tier1) {
                  return ((tier1 as any).amountWithLightstick ?? tier1.amount ?? challenge.prize_with_lightstick).toFixed(2);
                }
                return challenge.prize_with_lightstick.toFixed(2);
              })()}
              </span>
              !
            </p>
            <p className="text-muted-foreground text-xs">
              Lightstick holders get higher prizes and 70% better chance of winning! 🪄
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button asChild className="w-full h-12 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-600 hover:via-pink-600 hover:to-purple-600 text-white font-bold">
                <Link to="/rankings" onClick={() => setShowLightstickPromptDialog(false)}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Support Artist & Get Lightstick
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-12 rounded-full" onClick={() => {
              setShowLightstickPromptDialog(false);
              // 모달 닫고 바로 제출 진행
              handleSubmit();
            }}>
                Continue Without Lightstick
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>;
}