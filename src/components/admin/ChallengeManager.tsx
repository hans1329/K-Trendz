import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Trophy, Users, DollarSign, Gift, Loader2, CheckCircle, XCircle, Sparkles, ImagePlus, X, Search, Check, ListOrdered, FileText, Eye, RotateCcw, ExternalLink, Youtube, RefreshCw, AlertTriangle, Wallet, ClipboardCheck, EyeOff, Wand2, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface WikiEntryBasic {
  id: string;
  title: string;
  image_url: string | null;
  schema_type?: string;
}

// 객관식 옵션 타입
interface MultipleChoiceOption {
  id: string;
  label: string; // "1등", "2등" 등
  wiki_entry_id: string | null;
  wiki_entry?: WikiEntryBasic | null;
  text?: string; // 텍스트 옵션 (아티스트 외)
}

interface Challenge {
  id: string;
  question: string;
  correct_answer: string;
  options: any; // JSON 형태로 저장
  total_prize_usdc: number;
  winner_count: number;
  prize_with_lightstick: number;
  prize_without_lightstick: number;
  wiki_entry_id: string | null;
  image_url: string | null;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  entry_cost: number;
  selection_block_number?: number;
  selection_block_hash?: string;
  selection_seed?: string;
  selected_at?: string;
  admin_approved_at?: string;
  admin_approved_by?: string;
  claim_start_time?: string;
  claim_end_time?: string;
  answer_fetch_time?: string;
  wiki_entry?: {
    title: string;
    image_url: string | null;
  } | null;
  wiki_entries?: WikiEntryBasic[];
  participation_count?: number;
}

interface Participation {
  id: string;
  user_id: string;
  answer: string;
  has_lightstick: boolean;
  is_winner: boolean | null;
  prize_amount: number | null;
  created_at: string;
  source: 'internal' | 'external'; // 참여 출처
  profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface WinnerPreview {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rank: number;
  has_lightstick: boolean;
  prize_amount: number;
  answer: string;
  created_at: string;
}

type ChallengeType = 'subjective' | 'multiple_choice' | 'youtube';

export function ChallengeManager() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [wikiEntries, setWikiEntries] = useState<WikiEntryBasic[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectingWinners, setSelectingWinners] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiPopoverOpen, setWikiPopoverOpen] = useState(false);
  const [selectedWikiEntries, setSelectedWikiEntries] = useState<WikiEntryBasic[]>([]);
  
  // 참여자 목록 상태
  const [viewingParticipants, setViewingParticipants] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participation[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // 당첨자 미리보기 상태
  const [previewingWinners, setPreviewingWinners] = useState<Challenge | null>(null);
  const [winnerPreviews, setWinnerPreviews] = useState<WinnerPreview[]>([]);
  const [previewSelection, setPreviewSelection] = useState<{
    block_number: number;
    block_hash: string;
    selection_seed: string;
    total_correct_answers: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewTargetValue, setPreviewTargetValue] = useState<string>('');
  const [showPreviewTargetDialog, setShowPreviewTargetDialog] = useState<Challenge | null>(null);

  // Force End 확인 대화상자 상태
  const [forceEndChallengeId, setForceEndChallengeId] = useState<string | null>(null);
  
  // Reactivate 확인 대화상자 상태
  const [reactivateChallengeId, setReactivateChallengeId] = useState<string | null>(null);
  
  // 승인 대화상자 상태
  const [approvingChallenge, setApprovingChallenge] = useState<Challenge | null>(null);
  const [approvalClaimStartTime, setApprovalClaimStartTime] = useState('');
  const [approvalClaimEndTime, setApprovalClaimEndTime] = useState('');
  
  // 정답 설정 다이얼로그 상태 (객관식 챌린지용)
  const [settingAnswerChallenge, setSettingAnswerChallenge] = useState<Challenge | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isSettingAnswer, setIsSettingAnswer] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // 컨트랙트 잔액 상태
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [contractAddress, setContractAddress] = useState<string | null>(null);

  // 온체인 트랜잭션 상태
  const [onchainStatus, setOnchainStatus] = useState<{
    step: 'idle' | 'revealing' | 'selecting' | 'distributing';
    txHash?: string;
    error?: string;
    success?: boolean;
  }>({ step: 'idle' });

  const [challengeType, setChallengeType] = useState<ChallengeType>('subjective');
  
  // 객관식 옵션 상태
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<MultipleChoiceOption[]>([
    { id: '1', label: '1st', wiki_entry_id: null, text: '' },
    { id: '2', label: '2nd', wiki_entry_id: null, text: '' },
    { id: '3', label: '3rd', wiki_entry_id: null, text: '' },
    { id: '4', label: '4th', wiki_entry_id: null, text: '' },
  ]);
  
  // 옵션별 검색 상태
  const [optionSearchQueries, setOptionSearchQueries] = useState<Record<string, string>>({});
  const [activeOptionPopover, setActiveOptionPopover] = useState<string | null>(null);

  // 유튜브 챌린지 상태
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeInfo, setYoutubeInfo] = useState<{
    videoId: string;
    title: string;
    channelTitle: string;
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
    thumbnail: string | null;
    fetchedAt: string;
  } | null>(null);
  const [fetchingYoutubeInfo, setFetchingYoutubeInfo] = useState(false);
  const [youtubeTargetMetric, setYoutubeTargetMetric] = useState<'viewCount' | 'likeCount' | 'commentCount'>('viewCount');

  // Frame 이미지 생성 상태
  const [generatingFrameImage, setGeneratingFrameImage] = useState<string | null>(null);

  // Prize Pool 섹션 표시 여부
  const [showPrizePool, setShowPrizePool] = useState(true);

  const [prizeTiers, setPrizeTiers] = useState<{ rank: number; amountWithLightstick: number; amountWithoutLightstick: number; count: number }[]>([
    { rank: 1, amountWithLightstick: 50, amountWithoutLightstick: 25, count: 1 },
    { rank: 2, amountWithLightstick: 30, amountWithoutLightstick: 15, count: 2 },
    { rank: 3, amountWithLightstick: 20, amountWithoutLightstick: 10, count: 5 },
  ]);

  // 폼 상태
  const [form, setForm] = useState({
    question: '',
    correct_answer: '',
    total_prize_usdc: 100,
    winner_count: 10,
    prize_with_lightstick: 15,
    prize_without_lightstick: 5,
    wiki_entry_id: '',
    image_url: '',
    start_time: '',
    end_time: '',
    entry_cost: 0, // 참여 비용 (스타 포인트)
    answer_fetch_time: '', // YouTube 챌린지에서 정답을 가져올 시점
    status: 'active' as 'active' | 'test', // 챌린지 상태: active(공개) / test(테스트용)
  });

  useEffect(() => {
    fetchChallenges();
    fetchWikiEntries();
    fetchContractBalance();
  }, []);

  // 컨트랙트 USDC 잔액 조회
  const fetchContractBalance = async () => {
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-contract-balance');
      
      if (error) throw error;
      
      if (data?.success) {
        setContractBalance(data.data.usdcBalance);
        setContractAddress(data.data.contractAddress);
      }
    } catch (error: any) {
      console.error('Failed to fetch contract balance:', error);
      setContractBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          wiki_entry:wiki_entries(title, image_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 참여자 수 및 연결된 wiki entries 조회
      const challengesWithCount = await Promise.all(
        (data || []).map(async (challenge) => {
          const { count } = await supabase
            .from('challenge_participations')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', challenge.id);
          
          // 연결된 wiki entries 조회 (challenge_wiki_entries 테이블)
          const { data: wikiLinks } = await supabase
            .from('challenge_wiki_entries' as any)
            .select('wiki_entry_id, wiki_entries(id, title, image_url)')
            .eq('challenge_id', challenge.id);
          
          const wikiEntries = (wikiLinks || []).map((link: any) => link.wiki_entries).filter(Boolean) || [];
          
          return {
            ...challenge,
            participation_count: count || 0,
            wiki_entries: wikiEntries,
          };
        })
      );

      setChallenges(challengesWithCount);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWikiEntries = async () => {
    const { data } = await supabase
      .from('wiki_entries')
      .select('id, title, schema_type, image_url')
      .in('schema_type', ['artist', 'member'])
      .order('title');
    
    setWikiEntries(data || []);
  };

  // 참여자 목록 조회 (내부 + 외부 참여자 모두)
  const fetchParticipants = async (challenge: Challenge) => {
    setViewingParticipants(challenge);
    setLoadingParticipants(true);
    try {
      // 1. 내부 참여자 조회
      const { data: internalData, error: internalError } = await supabase
        .from('challenge_participations')
        .select('*')
        .eq('challenge_id', challenge.id)
        .order('created_at', { ascending: false });

      if (internalError) throw internalError;
      
      // 2. 외부 참여자 조회 (Farcaster 등) - 참여 기록만 먼저 조회
      const { data: externalData, error: externalError } = await supabase
        .from('external_challenge_participations')
        .select(`
          id,
          challenge_id,
          answer,
          has_lightstick,
          is_winner,
          prize_amount,
          created_at,
          external_wallet_id
        `)
        .eq('challenge_id', challenge.id)
        .order('created_at', { ascending: false });

      if (externalError) throw externalError;

      // 2-1. 외부 참여자 프로필 정보 조회 (공개 뷰 사용)
      const externalWalletIds = [...new Set((externalData || []).map(p => p.external_wallet_id))];
      const { data: externalProfilesData } = externalWalletIds.length > 0
        ? await supabase
            .from('external_wallet_profiles_public')
            .select('id, username, display_name, avatar_url, source')
            .in('id', externalWalletIds)
        : { data: [] };
      
      const externalProfilesMap = new Map((externalProfilesData || []).map(p => [p.id, p]));

      
      // 3. 내부 참여자 프로필 정보 조회
      const userIds = [...new Set((internalData || []).map(p => p.user_id))];
      const { data: profilesData } = userIds.length > 0 
        ? await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', userIds)
        : { data: [] };
      
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      // 4. 내부 참여자 데이터 변환
      const internalParticipants: Participation[] = (internalData || []).map(p => ({
        ...p,
        source: 'internal' as const,
        profile: profilesMap.get(p.user_id) || undefined,
      }));

      // 5. 외부 참여자 데이터 변환
      const externalParticipants: Participation[] = (externalData || []).map((p: any) => {
        const externalProfile = externalProfilesMap.get(p.external_wallet_id);
        return {
          id: p.id,
          user_id: p.external_wallet_id,
          answer: p.answer,
          has_lightstick: p.has_lightstick,
          is_winner: p.is_winner,
          prize_amount: p.prize_amount,
          created_at: p.created_at,
          source: 'external' as const,
          profile: {
            username: externalProfile?.username || 'External User',
            display_name: externalProfile?.display_name || null,
            avatar_url: externalProfile?.avatar_url || null,
          },
        };
      });

      // 6. 통합 및 시간순 정렬
      const allParticipants = [...internalParticipants, ...externalParticipants]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setParticipants(allParticipants);
    } catch (error: any) {
      toast({
        title: "Error loading participants",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingParticipants(false);
    }
  };

  // 답변 텍스트 변환 (객관식의 경우)
  const getAnswerDisplay = (answer: string, challenge: Challenge) => {
    const options = challenge.options;
    if (options?.type === 'multiple_choice' && options?.items) {
      const item = options.items.find((i: any) => i.id === answer);
      if (item) {
        const text = item.wiki_entry_title || item.text || '';
        return `${item.label}: ${text}`;
      }
    }
    return answer;
  };

  // 필터링된 wiki entries
  const filteredWikiEntries = wikiEntries.filter(entry =>
    entry.title.toLowerCase().includes(wikiSearchQuery.toLowerCase())
  );

  // 옵션별 필터링
  const getFilteredEntriesForOption = (optionId: string) => {
    const query = optionSearchQueries[optionId] || '';
    return wikiEntries.filter(entry =>
      entry.title.toLowerCase().includes(query.toLowerCase())
    );
  };

  const resetForm = () => {
    setForm({
      question: '',
      correct_answer: '',
      total_prize_usdc: 100,
      winner_count: 10,
      prize_with_lightstick: 15,
      prize_without_lightstick: 5,
      wiki_entry_id: '',
      image_url: '',
      start_time: '',
      end_time: '',
      entry_cost: 0,
      answer_fetch_time: '',
      status: 'active',
    });
    setImageFile(null);
    setImagePreview(null);
    setSelectedWikiEntries([]);
    setChallengeType('subjective');
    setMediaType('image');
    setVideoUrl('');
    setYoutubeUrl('');
    setYoutubeInfo(null);
    setYoutubeTargetMetric('viewCount');
    setMultipleChoiceOptions([
      { id: '1', label: '1st', wiki_entry_id: null, text: '' },
      { id: '2', label: '2nd', wiki_entry_id: null, text: '' },
      { id: '3', label: '3rd', wiki_entry_id: null, text: '' },
      { id: '4', label: '4th', wiki_entry_id: null, text: '' },
    ]);
    setOptionSearchQueries({});
    setActiveOptionPopover(null);
    setPrizeTiers([
      { rank: 1, amountWithLightstick: 50, amountWithoutLightstick: 25, count: 1 },
      { rank: 2, amountWithLightstick: 30, amountWithoutLightstick: 15, count: 2 },
      { rank: 3, amountWithLightstick: 20, amountWithoutLightstick: 10, count: 5 },
    ]);
  };

  // YouTube 챌린지 질문 자동 생성 함수
  // 유튜브 제목은 길어서 "the video"로 간략화 (실제 제목은 options에 저장됨)
  const generateYoutubeQuestion = (
    metric: 'viewCount' | 'likeCount' | 'commentCount',
    answerFetchTime: string,
    _videoTitle: string | null // 더 이상 질문에 포함하지 않음
  ): string => {
    const metricLabel = metric === 'viewCount' ? 'view count' 
      : metric === 'likeCount' ? 'like count' 
      : 'comment count';
    
    if (answerFetchTime) {
      const fetchDate = new Date(answerFetchTime);
      // 영문 로케일로 포맷팅
      const formattedDate = fetchDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      return `What will be the ${metricLabel} of the video on ${formattedDate}?`;
    }
    
    return `What will be the ${metricLabel} of the video?`;
  };

  // 유튜브 정보 가져오기
  const fetchYoutubeInfo = async (url: string) => {
    if (!url.trim()) return;
    
    setFetchingYoutubeInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-youtube-views', {
        body: { videoUrl: url }
      });
      
      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setYoutubeInfo(data);
      
      // 질문 자동 생성
      const autoQuestion = generateYoutubeQuestion(
        youtubeTargetMetric,
        form.answer_fetch_time,
        data.title
      );
      setForm(prev => ({ ...prev, question: autoQuestion }));
      
      toast({
        title: "YouTube info loaded",
        description: `${data.title} - ${data.viewCount.toLocaleString()} views`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to fetch YouTube info",
        description: error.message,
        variant: "destructive",
      });
      setYoutubeInfo(null);
    } finally {
      setFetchingYoutubeInfo(false);
    }
  };

  // Target Metric 변경 시 질문 자동 업데이트
  const handleYoutubeTargetMetricChange = (value: 'viewCount' | 'likeCount' | 'commentCount') => {
    setYoutubeTargetMetric(value);
    if (challengeType === 'youtube' && youtubeInfo) {
      const autoQuestion = generateYoutubeQuestion(value, form.answer_fetch_time, youtubeInfo.title);
      setForm(prev => ({ ...prev, question: autoQuestion }));
    }
  };

  // Answer Fetch Time 변경 시 질문 자동 업데이트
  const handleAnswerFetchTimeChange = (value: string) => {
    setForm(prev => ({ ...prev, answer_fetch_time: value }));
    if (challengeType === 'youtube' && youtubeInfo) {
      const autoQuestion = generateYoutubeQuestion(youtubeTargetMetric, value, youtubeInfo.title);
      setForm(prev => ({ ...prev, question: autoQuestion }));
    }
  };

  // 순위별 상금 추가
  const addPrizeTier = () => {
    const nextRank = prizeTiers.length + 1;
    setPrizeTiers([...prizeTiers, { rank: nextRank, amountWithLightstick: 10, amountWithoutLightstick: 5, count: 1 }]);
  };

  // 순위별 상금 삭제
  const removePrizeTier = (rank: number) => {
    if (prizeTiers.length <= 1) return;
    const filtered = prizeTiers.filter(t => t.rank !== rank);
    // 순위 재정렬
    setPrizeTiers(filtered.map((t, idx) => ({ ...t, rank: idx + 1 })));
  };

  // 순위별 상금 수정
  const updatePrizeTier = (rank: number, field: 'amountWithLightstick' | 'amountWithoutLightstick' | 'count', value: number) => {
    setPrizeTiers(prev => prev.map(t => t.rank === rank ? { ...t, [field]: value } : t));
  };

  // 총 상금 계산 (응원봉 보유 기준 최대 상금)
  const calculateTotalPrize = () => {
    return prizeTiers.reduce((sum, tier) => sum + (tier.amountWithLightstick * tier.count), 0);
  };

  // 총 당첨자 수 계산
  const calculateTotalWinners = () => {
    return prizeTiers.reduce((sum, tier) => sum + tier.count, 0);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;
    
    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `challenges/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('challenge-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('challenge-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm({ ...form, image_url: '' });
    setVideoUrl('');
  };

  // YouTube URL에서 video ID 추출
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // YouTube URL 유효성 검사
  const isValidYouTubeUrl = (url: string): boolean => {
    return getYouTubeVideoId(url) !== null;
  };

  // 객관식 옵션 추가
  const addOption = () => {
    const nextNum = multipleChoiceOptions.length + 1;
    const suffix = getOrdinalSuffix(nextNum);
    setMultipleChoiceOptions([
      ...multipleChoiceOptions,
      { id: String(nextNum), label: `${nextNum}${suffix}`, wiki_entry_id: null, text: '' }
    ]);
  };

  // 객관식 옵션 삭제
  const removeOption = (id: string) => {
    if (multipleChoiceOptions.length <= 2) {
      toast({
        title: "Minimum 2 options required",
        variant: "destructive",
      });
      return;
    }
    setMultipleChoiceOptions(multipleChoiceOptions.filter(opt => opt.id !== id));
  };

  // 서수 접미사 가져오기
  const getOrdinalSuffix = (n: number): string => {
    if (n % 100 >= 11 && n % 100 <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // 옵션에 아티스트 설정
  const setOptionWikiEntry = (optionId: string, entry: WikiEntryBasic | null) => {
    setMultipleChoiceOptions(prev => prev.map(opt => {
      if (opt.id === optionId) {
        return { 
          ...opt, 
          wiki_entry_id: entry?.id || null, 
          wiki_entry: entry,
          text: entry ? '' : opt.text // 아티스트 선택 시 텍스트 초기화
        };
      }
      return opt;
    }));
    setActiveOptionPopover(null);
    
    // 자동으로 "Limit Participation to Fans of"에 추가
    if (entry && !selectedWikiEntries.some(e => e.id === entry.id)) {
      setSelectedWikiEntries(prev => [...prev, entry]);
    }
  };

  // 옵션 텍스트 변경
  const setOptionText = (optionId: string, text: string) => {
    setMultipleChoiceOptions(prev => prev.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, text, wiki_entry_id: null, wiki_entry: null };
      }
      return opt;
    }));
  };

  const handleCreate = async () => {
    if (!form.question || !form.end_time) {
      toast({
        title: "Validation Error",
        description: "Please fill in question and end time",
        variant: "destructive",
      });
      return;
    }

    // 객관식인 경우 옵션 검증
    if (challengeType === 'multiple_choice') {
      const validOptions = multipleChoiceOptions.filter(opt => opt.wiki_entry_id || opt.text?.trim());
      if (validOptions.length < 2) {
        toast({
          title: "Validation Error",
          description: "Please set at least 2 options",
          variant: "destructive",
        });
        return;
      }
    }

    // 유튜브 챌린지인 경우 URL 및 시간 검증
    if (challengeType === 'youtube') {
      if (!youtubeUrl.trim() || !youtubeInfo) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid YouTube URL and fetch video info",
          variant: "destructive",
        });
        return;
      }
      
      // Answer Fetch Time이 End Time 이후인지 검증
      if (form.answer_fetch_time && form.end_time) {
        const answerFetchDate = new Date(form.answer_fetch_time);
        const endDate = new Date(form.end_time);
        if (answerFetchDate < endDate) {
          toast({
            title: "Validation Error",
            description: "Answer Fetch Time must be after Entry Deadline",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 미디어 URL 결정 (이미지 업로드 또는 비디오 URL)
      let finalMediaUrl: string | null = null;
      if (mediaType === 'video' && videoUrl.trim()) {
        finalMediaUrl = videoUrl.trim();
      } else {
        finalMediaUrl = await uploadImage();
      }

      // 옵션 데이터 구성 (순위별 상금 포함)
      let optionsData: any;
      if (challengeType === 'multiple_choice') {
        optionsData = {
          type: 'multiple_choice',
          items: multipleChoiceOptions.map(opt => ({
            id: opt.id,
            label: opt.label,
            wiki_entry_id: opt.wiki_entry_id,
            wiki_entry_title: opt.wiki_entry?.title || null,
            text: opt.text || null,
          })),
          prize_tiers: prizeTiers,
        };
      } else if (challengeType === 'youtube') {
        optionsData = {
          type: 'youtube',
          youtube_url: youtubeUrl,
          youtube_video_id: youtubeInfo?.videoId,
          youtube_title: youtubeInfo?.title,
          youtube_channel: youtubeInfo?.channelTitle,
          youtube_initial_views: youtubeInfo?.viewCount,
          youtube_initial_likes: youtubeInfo?.likeCount,
          youtube_initial_comments: youtubeInfo?.commentCount,
          youtube_fetched_at: youtubeInfo?.fetchedAt,
          youtube_target_metric: youtubeTargetMetric, // 정답으로 사용할 데이터 타입
          prize_tiers: prizeTiers,
        };
      } else {
        optionsData = { 
          type: 'subjective',
          prize_tiers: prizeTiers,
        };
      }

      // 로컬 시간을 UTC ISO 문자열로 변환
      const startTimeISO = form.start_time 
        ? new Date(form.start_time).toISOString() 
        : new Date().toISOString();
      const endTimeISO = form.end_time 
        ? new Date(form.end_time).toISOString() 
        : new Date().toISOString();

      // YouTube 챌린지의 경우 answer_fetch_time 설정
      const answerFetchTimeISO = challengeType === 'youtube' && form.answer_fetch_time
        ? new Date(form.answer_fetch_time).toISOString()
        : null;

      // claim_end_time: end_time + 30일
      const claimEndDate = new Date(endTimeISO);
      claimEndDate.setDate(claimEndDate.getDate() + 30);
      const claimEndTimeISO = claimEndDate.toISOString();

      const { data: insertedChallenge, error } = await supabase.from('challenges').insert({
        question: form.question,
        correct_answer: '', // 정답은 나중에 설정 (YouTube 챌린지는 자동으로 가져옴)
        options: optionsData,
        total_prize_usdc: calculateTotalPrize(),
        winner_count: calculateTotalWinners(),
        prize_with_lightstick: prizeTiers[0]?.amountWithLightstick || 0,
        prize_without_lightstick: prizeTiers[0]?.amountWithoutLightstick || 0,
        wiki_entry_id: selectedWikiEntries.length > 0 ? selectedWikiEntries[0].id : null,
        image_url: finalMediaUrl,
        start_time: startTimeISO,
        end_time: endTimeISO,
        claim_end_time: claimEndTimeISO,
        created_by: user.id,
        entry_cost: form.entry_cost,
        answer_fetch_time: answerFetchTimeISO,
        status: form.status, // 챌린지 상태 (active/test)
      }).select('id').single();

      if (error) throw error;

      // 다중 wiki entry 연결 (참여 제한용)
      if (selectedWikiEntries.length > 0 && insertedChallenge) {
        const wikiLinks = selectedWikiEntries.map(entry => ({
          challenge_id: insertedChallenge.id,
          wiki_entry_id: entry.id,
        }));
        await (supabase.from('challenge_wiki_entries' as any) as any).insert(wikiLinks);
      }

      // 온체인에 챌린지 생성 (백그라운드)
      // - create-challenge-onchain 실패가 DB 생성까지 막지 않도록 분리
      // - Promise reject(500 등)로 인한 unhandled rejection이 화면을 깨뜨리지 않도록 catch 처리
      if (insertedChallenge) {
        void supabase.functions
          .invoke('create-challenge-onchain', {
            body: {
              challengeId: insertedChallenge.id,
              question: form.question,
              correctAnswer: form.correct_answer || 'pending',
              prizePool: calculateTotalPrize(),
              prizeWithLightstick: prizeTiers[0]?.amountWithLightstick || 0,
              prizeWithoutLightstick: prizeTiers[0]?.amountWithoutLightstick || 0,
              startTime: Math.floor(new Date(startTimeISO).getTime() / 1000),
              endTime: Math.floor(new Date(endTimeISO).getTime() / 1000),
              winnerCount: calculateTotalWinners(),
            },
          })
          .then(({ data, error }) => {
            if (error) {
              console.error('Failed to create challenge onchain:', error);
              toast({
                title: 'On-chain creation failed',
                description: 'Challenge was created in the database, but on-chain creation failed.',
                variant: 'destructive',
              });
              return;
            }
            console.log('Challenge created onchain:', data);
          })
          .catch((e) => {
            console.error('Failed to create challenge onchain (rejected):', e);
            toast({
              title: 'On-chain creation failed',
              description: 'Challenge was created in the database, but on-chain creation failed.',
              variant: 'destructive',
            });
          });
      }

      toast({ title: "Challenge created successfully" });
      setShowCreateDialog(false);
      resetForm();
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingChallenge) return;

    // 유튜브 챌린지인 경우 Answer Fetch Time 검증
    if (challengeType === 'youtube' && form.answer_fetch_time && form.end_time) {
      const answerFetchDate = new Date(form.answer_fetch_time);
      const endDate = new Date(form.end_time);
      if (answerFetchDate < endDate) {
        toast({
          title: "Validation Error",
          description: "Answer Fetch Time must be after Entry Deadline",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 미디어 URL 결정 (이미지 업로드 또는 비디오 URL)
      let finalMediaUrl: string | null = null;
      if (mediaType === 'video' && videoUrl.trim()) {
        finalMediaUrl = videoUrl.trim();
      } else {
        finalMediaUrl = await uploadImage();
      }

      // 옵션 데이터 구성 (순위별 상금 포함)
      let optionsData: any;
      if (challengeType === 'multiple_choice') {
        optionsData = {
          type: 'multiple_choice',
          items: multipleChoiceOptions.map(opt => ({
            id: opt.id,
            label: opt.label,
            wiki_entry_id: opt.wiki_entry_id,
            wiki_entry_title: opt.wiki_entry?.title || null,
            text: opt.text || null,
          })),
          prize_tiers: prizeTiers,
        };
      } else if (challengeType === 'youtube') {
        optionsData = {
          type: 'youtube',
          youtube_url: youtubeUrl,
          youtube_video_id: youtubeInfo?.videoId,
          youtube_title: youtubeInfo?.title,
          youtube_channel: youtubeInfo?.channelTitle,
          youtube_initial_views: youtubeInfo?.viewCount,
          youtube_initial_likes: youtubeInfo?.likeCount,
          youtube_initial_comments: youtubeInfo?.commentCount,
          youtube_fetched_at: youtubeInfo?.fetchedAt,
          youtube_target_metric: youtubeTargetMetric, // 정답으로 사용할 데이터 타입
          prize_tiers: prizeTiers,
        };
      } else {
        optionsData = { 
          type: 'subjective',
          prize_tiers: prizeTiers,
        };
      }

      // 로컬 시간을 UTC ISO 문자열로 변환
      const startTimeISO = form.start_time 
        ? new Date(form.start_time).toISOString() 
        : new Date().toISOString();
      const endTimeISO = form.end_time 
        ? new Date(form.end_time).toISOString() 
        : new Date().toISOString();

      // YouTube 챌린지의 경우 answer_fetch_time 설정
      const answerFetchTimeISO = challengeType === 'youtube' && form.answer_fetch_time
        ? new Date(form.answer_fetch_time).toISOString()
        : null;

      const { error } = await supabase
        .from('challenges')
        .update({
          question: form.question,
          correct_answer: form.correct_answer,
          options: optionsData,
          total_prize_usdc: calculateTotalPrize(),
          winner_count: calculateTotalWinners(),
          prize_with_lightstick: prizeTiers[0]?.amountWithLightstick || 0,
          prize_without_lightstick: prizeTiers[0]?.amountWithoutLightstick || 0,
          wiki_entry_id: selectedWikiEntries.length > 0 ? selectedWikiEntries[0].id : null,
          image_url: finalMediaUrl,
          start_time: startTimeISO,
          end_time: endTimeISO,
          entry_cost: form.entry_cost,
          answer_fetch_time: answerFetchTimeISO,
          status: form.status, // 챌린지 상태 (active/test)
        })
        .eq('id', editingChallenge.id);

      if (error) throw error;

      // 기존 연결 삭제 후 새로 연결
      await (supabase.from('challenge_wiki_entries' as any) as any)
        .delete()
        .eq('challenge_id', editingChallenge.id);

      if (selectedWikiEntries.length > 0) {
        const wikiLinks = selectedWikiEntries.map(entry => ({
          challenge_id: editingChallenge.id,
          wiki_entry_id: entry.id,
        }));
        
        await (supabase.from('challenge_wiki_entries' as any) as any).insert(wikiLinks);
      }

      toast({ title: "Challenge updated successfully" });
      setEditingChallenge(null);
      resetForm();
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this challenge?")) return;

    try {
      const { error } = await supabase
        .from('challenges')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Challenge deleted" });
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEndChallenge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'ended' })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Challenge ended" });
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReactivateChallenge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Challenge reactivated" });
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    
    // 옵션 타입 확인 및 설정
    const options = challenge.options as any;
    if (options?.type === 'multiple_choice' && options.items) {
      setChallengeType('multiple_choice');
      setMultipleChoiceOptions(options.items.map((item: any) => ({
        id: item.id,
        label: item.label,
        wiki_entry_id: item.wiki_entry_id,
        wiki_entry: item.wiki_entry_id ? { id: item.wiki_entry_id, title: item.wiki_entry_title, image_url: null } : null,
        text: item.text || '',
      })));
      setYoutubeUrl('');
      setYoutubeInfo(null);
    } else if (options?.type === 'youtube') {
      setChallengeType('youtube');
      setYoutubeUrl(options.youtube_url || '');
      setYoutubeInfo(options.youtube_video_id ? {
        videoId: options.youtube_video_id,
        title: options.youtube_title || '',
        channelTitle: options.youtube_channel || '',
        viewCount: options.youtube_initial_views || 0,
        likeCount: options.youtube_initial_likes || null,
        commentCount: options.youtube_initial_comments || null,
        thumbnail: null,
        fetchedAt: options.youtube_fetched_at || new Date().toISOString(),
      } : null);
      setYoutubeTargetMetric(options.youtube_target_metric || 'viewCount');
      setMultipleChoiceOptions([
        { id: '1', label: '1st', wiki_entry_id: null, text: '' },
        { id: '2', label: '2nd', wiki_entry_id: null, text: '' },
        { id: '3', label: '3rd', wiki_entry_id: null, text: '' },
        { id: '4', label: '4th', wiki_entry_id: null, text: '' },
      ]);
    } else {
      setChallengeType('subjective');
      setYoutubeUrl('');
      setYoutubeInfo(null);
      setMultipleChoiceOptions([
        { id: '1', label: '1st', wiki_entry_id: null, text: '' },
        { id: '2', label: '2nd', wiki_entry_id: null, text: '' },
        { id: '3', label: '3rd', wiki_entry_id: null, text: '' },
        { id: '4', label: '4th', wiki_entry_id: null, text: '' },
      ]);
    }
    
    // 순위별 상금 설정
    if (options?.prize_tiers && Array.isArray(options.prize_tiers)) {
      // 새 구조 (amountWithLightstick, amountWithoutLightstick) 및 레거시 구조 (amount) 모두 지원
      setPrizeTiers(options.prize_tiers.map((t: any) => ({
        rank: t.rank,
        amountWithLightstick: t.amountWithLightstick ?? t.amount ?? 10,
        amountWithoutLightstick: t.amountWithoutLightstick ?? Math.floor((t.amount ?? 10) / 2),
        count: t.count || 1,
      })));
    } else {
      // 레거시 데이터 호환: 기존 prize_with_lightstick / prize_without_lightstick 사용
      const tiers = [];
      for (let i = 0; i < Math.min(challenge.winner_count, 3); i++) {
        tiers.push({ 
          rank: i + 1, 
          amountWithLightstick: i === 0 ? challenge.prize_with_lightstick : Math.floor(challenge.prize_with_lightstick / (i + 1)),
          amountWithoutLightstick: i === 0 ? challenge.prize_without_lightstick : Math.floor(challenge.prize_without_lightstick / (i + 1)),
          count: i === 0 ? 1 : Math.floor((challenge.winner_count - 1) / 2),
        });
      }
      setPrizeTiers(tiers.length > 0 ? tiers : [
        { rank: 1, amountWithLightstick: 50, amountWithoutLightstick: 25, count: 1 },
        { rank: 2, amountWithLightstick: 30, amountWithoutLightstick: 15, count: 2 },
        { rank: 3, amountWithLightstick: 20, amountWithoutLightstick: 10, count: 5 },
      ]);
    }
    
    // UTC ISO 문자열을 로컬 datetime-local 형식으로 변환
    const toLocalDateTimeString = (isoString: string | null | undefined) => {
      if (!isoString) return '';
      return format(new Date(isoString), "yyyy-MM-dd'T'HH:mm");
    };
    
    setForm({
      question: challenge.question,
      correct_answer: challenge.correct_answer,
      total_prize_usdc: challenge.total_prize_usdc,
      winner_count: challenge.winner_count,
      prize_with_lightstick: challenge.prize_with_lightstick,
      prize_without_lightstick: challenge.prize_without_lightstick,
      wiki_entry_id: challenge.wiki_entry_id || '',
      image_url: challenge.image_url || '',
      start_time: toLocalDateTimeString(challenge.start_time),
      end_time: toLocalDateTimeString(challenge.end_time),
      entry_cost: (challenge as any).entry_cost || 0,
      answer_fetch_time: toLocalDateTimeString((challenge as any).answer_fetch_time),
      status: challenge.status === 'test' ? 'test' : 'active',
    });
    setImageFile(null);
    
    // 미디어 타입 결정 (YouTube URL인 경우 video로 설정)
    const imageUrl = challenge.image_url || '';
    const isVideoUrl = imageUrl && (imageUrl.includes('youtube.com') || imageUrl.includes('youtu.be'));
    setMediaType(isVideoUrl ? 'video' : 'image');
    setVideoUrl(isVideoUrl ? imageUrl : '');
    setImagePreview(isVideoUrl ? null : imageUrl || null);
    
    setSelectedWikiEntries(challenge.wiki_entries || []);
  };

  // 다중 아티스트 선택/해제 토글 (참여 제한용)
  const toggleWikiEntry = (entry: WikiEntryBasic) => {
    setSelectedWikiEntries(prev => {
      const exists = prev.find(e => e.id === entry.id);
      if (exists) {
        return prev.filter(e => e.id !== entry.id);
      }
      return [...prev, entry];
    });
  };

  const removeWikiEntry = (entryId: string) => {
    setSelectedWikiEntries(prev => prev.filter(e => e.id !== entryId));
  };

  // YouTube 챌린지 프리뷰 시 타겟 값 입력 다이얼로그 표시
  const handlePreviewWinnersClick = (challenge: Challenge) => {
    const options = challenge.options as any;
    const challengeType = options?.type || options?.challenge_type || 'multiple_choice';
    
    // YouTube 챌린지이고 정답이 아직 설정되지 않았거나 프리뷰용 값을 입력받고 싶을 때
    if (challengeType === 'youtube') {
      setPreviewTargetValue(challenge.correct_answer || '');
      setShowPreviewTargetDialog(challenge);
    } else {
      handlePreviewWinners(challenge);
    }
  };

  // 당첨자 미리보기 함수
  const handlePreviewWinners = async (challenge: Challenge, overrideTargetValue?: string) => {
    setPreviewingWinners(challenge);
    setLoadingPreview(true);
    setWinnerPreviews([]);
    setPreviewSelection(null);
    setShowPreviewTargetDialog(null);

    try {
      const { data, error } = await supabase.functions.invoke('select-challenge-winners', {
        body: { 
          challengeId: challenge.id, 
          preview: true,
          previewTargetValue: overrideTargetValue || undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        setWinnerPreviews(data.winners || []);
        setPreviewSelection({
          block_number: data.selection?.block_number,
          block_hash: data.selection?.block_hash,
          selection_seed: data.selection?.selection_seed,
          total_correct_answers: data.verification?.total_correct_answers || 0
        });
      } else {
        throw new Error(data.error || 'Failed to preview winners');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setPreviewingWinners(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // 실제 당첨자 선정 (미리보기에서 확인 후) - 온체인 기록은 승인 시 수행
  const handleConfirmWinners = async () => {
    if (!previewingWinners) return;
    if (!confirm("Are you sure you want to confirm winners? This action cannot be undone.")) return;

    setSelectingWinners(previewingWinners.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('select-challenge-winners', {
        body: { challengeId: previewingWinners.id, preview: false }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Winners Confirmed",
          description: (
            <div className="flex flex-col gap-1">
              <span>{data.winners?.length || 0} winner(s) selected using block #{data.selection?.block_number}</span>
              <span className="text-xs text-muted-foreground">
                Please approve to notify winners and distribute prizes.
              </span>
            </div>
          ),
        });

        setPreviewingWinners(null);
        fetchChallenges();
      } else {
        throw new Error(data.error || 'Failed to select winners');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSelectingWinners(null);
    }
  };

  const getStatusBadge = (challenge: Challenge) => {
    const now = new Date();
    const start = new Date(challenge.start_time);
    const end = new Date(challenge.end_time);
    
    // 클레임 가능 상태
    if (challenge.admin_approved_at && challenge.claim_start_time) {
      const claimStart = new Date(challenge.claim_start_time);
      const claimEnd = challenge.claim_end_time ? new Date(challenge.claim_end_time) : null;
      if (claimEnd && now > claimEnd) {
        return <Badge variant="secondary">Claim Ended</Badge>;
      }
      if (now >= claimStart) {
        return <Badge className="bg-green-600">Claimable</Badge>;
      }
      return <Badge className="bg-blue-500">Approved (Claim Pending)</Badge>;
    }
    
    // 당첨자 선정 완료 (승인 대기)
    if (challenge.selected_at && !challenge.admin_approved_at) {
      return <Badge className="bg-yellow-500">Awaiting Approval</Badge>;
    }
    
    if (challenge.selected_at) {
      return <Badge className="bg-purple-500">Winners Selected</Badge>;
    }
    if (challenge.status === 'ended' || challenge.status === 'cancelled') {
      return <Badge variant="secondary">{challenge.status}</Badge>;
    }
    if (end < now) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Awaiting Selection</Badge>;
    }
    if (start > now) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Scheduled</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  // 챌린지 승인 핸들러 (알림 전송 + 온체인 기록 + USDC 분배)
  const handleApproveChallenge = async () => {
    if (!approvingChallenge || !approvalClaimStartTime) {
      toast({
        title: "Error",
        description: "Please set claim start time",
        variant: "destructive",
      });
      return;
    }

    // USDC 잔액 체크
    const totalPrize = approvingChallenge.total_prize_usdc;
    if (contractBalance !== null && parseFloat(contractBalance) < totalPrize) {
      toast({
        title: "Insufficient Contract Balance",
        description: `Contract has ${contractBalance} USDC but ${totalPrize} USDC is needed for prizes.`,
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);
    setOnchainStatus({ step: 'selecting' });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. 챌린지 정보 업데이트 (승인 시간, 클레임 기간)
      const { error } = await supabase
        .from('challenges')
        .update({
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: user.id,
          claim_start_time: new Date(approvalClaimStartTime).toISOString(),
          claim_end_time: approvalClaimEndTime ? new Date(approvalClaimEndTime).toISOString() : null,
        })
        .eq('id', approvingChallenge.id);

      if (error) throw error;

      // 2. 당첨자 정보 조회
      const { data: winnersData } = await supabase
        .from('challenge_participations')
        .select('user_id, prize_amount')
        .eq('challenge_id', approvingChallenge.id)
        .eq('is_winner', true);

      if (winnersData && winnersData.length > 0) {
        const winnerUserIds = winnersData.map(w => w.user_id);
        const { data: walletData } = await supabase
          .from('wallet_addresses')
          .select('user_id, wallet_address')
          .in('user_id', winnerUserIds);

        const walletMap = new Map(walletData?.map(w => [w.user_id, w.wallet_address]) || []);
        
        // 3. 당첨자에게 알림 전송
        const { data: challengeData } = await supabase
          .from('challenges')
          .select('question, options')
          .eq('id', approvingChallenge.id)
          .single();
        
        const options = challengeData?.options as any;
        const prizeTiers = options?.prize_tiers || [];
        
        for (const winner of winnersData) {
          const prizeAmount = winner.prize_amount || 0;
          let rankSuffix = '';
          
          // 순위 찾기
          if (prizeTiers.length > 0) {
            let cumulativeCount = 0;
            for (const tier of prizeTiers) {
              cumulativeCount += tier.count || 1;
              if (tier.amount === prizeAmount) {
                const rank = tier.rank;
                rankSuffix = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
                break;
              }
            }
          }
          
          await supabase
            .from('notifications')
            .insert({
              user_id: winner.user_id,
              type: 'challenge_win',
              title: rankSuffix ? `Congratulations! You Won ${rankSuffix} Place!` : 'Congratulations! You Won!',
              message: `You won $${prizeAmount}${rankSuffix ? ` (${rankSuffix} place)` : ''} in the challenge: "${challengeData?.question}"`,
              reference_id: approvingChallenge.id
            });
        }

        // 4. 온체인에 당첨자 기록
        const winnerAddresses = walletData?.map(w => w.wallet_address) || [];
        
        if (winnerAddresses.length > 0) {
          const { data: selectOnchainData, error: selectOnchainError } = await supabase.functions.invoke('select-winners-onchain', {
            body: {
              challengeId: approvingChallenge.id,
              winnerAddresses,
            }
          });

          if (selectOnchainError || !selectOnchainData?.success) {
            console.error('On-chain winner selection failed:', selectOnchainError?.message || selectOnchainData?.error);
            // 실패해도 계속 진행 (상금 분배는 시도)
          }
        }

        // 5. DB 기반 상금 배포 (K-Trendz 사용자)
        setOnchainStatus({ step: 'distributing' });
        
        const winners = winnersData.map(w => ({
          userId: w.user_id,
          amount: w.prize_amount || 0,
          address: walletMap.get(w.user_id),
        }));

        let dbDistributionSuccess = false;
        if (winners.length > 0) {
          const { data: dbData, error: dbError } = await supabase.functions.invoke('distribute-prizes-db', {
            body: {
              challengeId: approvingChallenge.id,
              winners,
            }
          });

          if (dbError || !dbData?.success) {
            console.error('DB prize distribution failed:', dbError?.message || dbData?.error);
          } else {
            dbDistributionSuccess = true;
            console.log(`DB distribution: ${dbData.data?.successCount} winners, $${dbData.data?.totalDistributed}`);
          }
        }

        // 6. External winners 는 클레임 방식으로 변경됨 - 자동 송금 하지 않음
        // 외부 사용자는 /earn 페이지에서 직접 클레임하여 상금 수령
        const { count: externalWinnerCount } = await supabase
          .from('external_challenge_participations')
          .select('*', { count: 'exact', head: true })
          .eq('challenge_id', approvingChallenge.id)
          .eq('is_winner', true)
          .is('claimed_at', null);

        setOnchainStatus({ step: 'idle', success: dbDistributionSuccess });
        
        const internalCount = winners.length;
        const externalCount = externalWinnerCount || 0;
        
        toast({
          title: "Approved & Prizes Distributed!",
          description: (
            <div className="flex flex-col gap-1">
              <span>K-Trendz winners notified and prizes distributed.</span>
              {externalCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  External: {externalCount} winner(s) can claim on /earn page
                </span>
              )}
            </div>
          ),
        });
      } else {
        toast({
          title: "Approved",
          description: "Challenge approved. No winners to distribute to.",
        });
      }

      setApprovingChallenge(null);
      setApprovalClaimStartTime('');
      setApprovalClaimEndTime('');
      fetchChallenges();
    } catch (error: any) {
      setOnchainStatus({ step: 'idle', error: error.message });
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // 객관식 챌린지 정답 설정 핸들러
  const handleSetAnswer = async () => {
    if (!settingAnswerChallenge || !selectedAnswer) {
      toast({
        title: "Error",
        description: "Please select an answer",
        variant: "destructive",
      });
      return;
    }

    setIsSettingAnswer(true);
    setOnchainStatus({ step: 'revealing' });
    
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ correct_answer: selectedAnswer })
        .eq('id', settingAnswerChallenge.id);

      if (error) throw error;

      // 온체인에 정답 공개 (await로 대기)
      const { data: onchainData, error: onchainError } = await supabase.functions.invoke('reveal-answer-onchain', {
        body: {
          challengeId: settingAnswerChallenge.id,
          correctAnswer: selectedAnswer,
        }
      });

      if (onchainError || !onchainData?.success) {
        setOnchainStatus({ 
          step: 'idle', 
          error: onchainError?.message || onchainData?.error || 'On-chain reveal failed' 
        });
        toast({
          title: "On-chain reveal failed",
          description: "Answer was saved to DB, but on-chain reveal failed. Please retry.",
          variant: "destructive",
        });
      } else {
        setOnchainStatus({ 
          step: 'idle', 
          success: true, 
          txHash: onchainData.data?.txHash 
        });
        toast({
          title: "Answer Set & Revealed On-chain",
          description: (
            <div className="flex flex-col gap-1">
              <span>Correct answer has been set. You can now select winners.</span>
              {onchainData.data?.txHash && (
                <a 
                  href={`https://basescan.org/tx/${onchainData.data.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  View on BaseScan <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ),
        });
      }

      setSettingAnswerChallenge(null);
      setSelectedAnswer('');
      fetchChallenges();
    } catch (error: any) {
      setOnchainStatus({ step: 'idle', error: error.message });
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSettingAnswer(false);
    }
  };

  // 객관식 챌린지에서 정답 설정이 필요한지 확인
  const needsAnswerSetting = (challenge: Challenge): boolean => {
    const options = challenge.options as any;
    // 객관식이고 정답이 설정되지 않았으며 종료된 경우
    return options?.type === 'multiple_choice' && 
           !challenge.correct_answer && 
           new Date(challenge.end_time) < new Date() &&
           !challenge.selected_at;
  };
  // 챌린지 타입 표시
  const getChallengeTypeBadge = (challenge: Challenge) => {
    const options = challenge.options as any;
    if (options?.type === 'multiple_choice') {
      return <Badge variant="outline" className="text-xs"><ListOrdered className="h-3 w-3 mr-1" /> Multiple</Badge>;
    }
    if (options?.type === 'youtube') {
      return <Badge variant="outline" className="text-xs border-red-500/50 text-red-600"><Youtube className="h-3 w-3 mr-1" /> YouTube</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><FileText className="h-3 w-3 mr-1" /> Open</Badge>;
  };

  // 객관식 옵션 가져오기
  const getMultipleChoiceOptionsDisplay = (challenge: Challenge) => {
    const options = challenge.options as any;
    if (options?.type === 'multiple_choice' && options.items) {
      return options.items.map((item: any) => item.wiki_entry_title || item.text || `Option ${item.id}`).join(', ');
    }
    return null;
  };

  // Frame 이미지 생성 핸들러
  const handleGenerateFrameImage = async (challengeId: string) => {
    setGeneratingFrameImage(challengeId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-frame-image', {
        body: { challengeId }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Frame Image Generated",
          description: "The AI-generated Frame image has been saved.",
        });
        fetchChallenges(); // Refresh to show new image
      } else {
        throw new Error(data?.error || 'Failed to generate image');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingFrameImage(null);
    }
  };

  // Frame URL 복사 핸들러 (path 기반 URL 사용)
  const copyFrameUrl = (challengeId: string) => {
    // Mini App v2 embed - Edge Function이 fc:frame JSON 반환
    const frameUrl = `https://k-trendz.com/api/farcaster-challenge-frame/${challengeId}`;
    navigator.clipboard.writeText(frameUrl);
    toast({
      title: "Copied!",
      description: "Mini App embed URL copied to clipboard",
    });
  };

  // Galxe REST Credential 엔드포인트 복사 핸들러
  const copyGalxeUrl = (challengeId: string) => {
    const galxeUrl = `https://k-trendz.com/api/galxe-verify?address=$address&challengeId=${challengeId}`;
    navigator.clipboard.writeText(galxeUrl);
    toast({
      title: "Copied!",
      description: "Galxe REST Credential endpoint copied to clipboard",
    });
  };

  // 필요 상금 총액 계산 (Awaiting Approval 상태인 챌린지들)
  const getTotalPrizeNeeded = () => {
    return challenges
      .filter(c => c.selected_at && !c.admin_approved_at)
      .reduce((sum, c) => sum + c.total_prize_usdc, 0);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Challenge Management
            </CardTitle>
            <CardDescription>
              Create and manage prediction challenges for fans
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Challenge
          </Button>
        </div>

        {/* Prize Pool 토글 버튼 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPrizePool(!showPrizePool)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showPrizePool ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPrizePool ? 'Hide Prize Pool' : 'Show Prize Pool'}
          </Button>
        </div>

        {/* 컨트랙트 잔액 표시 - 토글 가능 */}
        {showPrizePool && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Contract USDC:</span>
              {loadingBalance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : contractBalance !== null ? (
                <span className="font-mono font-semibold text-foreground">${contractBalance}</span>
              ) : (
                <span className="text-destructive text-sm">Failed to load</span>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={fetchContractBalance}
                disabled={loadingBalance}
              >
                <RefreshCw className={cn("h-3 w-3", loadingBalance && "animate-spin")} />
              </Button>
              {contractAddress && (
                <a 
                  href={`https://basescan.org/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* 경고: 잔액 부족 */}
            {contractBalance !== null && getTotalPrizeNeeded() > parseFloat(contractBalance) && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Insufficient Balance</AlertTitle>
                <AlertDescription className="text-xs">
                  Need ${getTotalPrizeNeeded()} USDC for pending approvals, but contract only has ${contractBalance} USDC.
                </AlertDescription>
              </Alert>
            )}

            {/* 온체인 상태 표시 */}
            {onchainStatus.step !== 'idle' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-blue-600">
                  {onchainStatus.step === 'revealing' && 'Revealing answer on-chain...'}
                  {onchainStatus.step === 'selecting' && 'Recording winners on-chain...'}
                  {onchainStatus.step === 'distributing' && 'Distributing prizes on-chain...'}
                </span>
              </div>
            )}

            {onchainStatus.error && onchainStatus.step === 'idle' && (
              <Alert variant="destructive" className="py-2">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{onchainStatus.error}</AlertDescription>
              </Alert>
            )}

            {onchainStatus.success && onchainStatus.txHash && onchainStatus.step === 'idle' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <a 
                  href={`https://basescan.org/tx/${onchainStatus.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:underline flex items-center gap-1"
                >
                  Last tx: {onchainStatus.txHash.slice(0, 10)}...
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No challenges yet. Create one to get started!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Frame Preview</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead>Prize</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Answer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entry Deadline</TableHead>
                <TableHead>Prize Pool</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challenges.map((challenge) => (
                <TableRow key={challenge.id}>
                  <TableCell>
                    {getChallengeTypeBadge(challenge)}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate">{challenge.question}</div>
                    {getMultipleChoiceOptionsDisplay(challenge) && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        Options: {getMultipleChoiceOptionsDisplay(challenge)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {challenge.image_url ? (
                        <div className="relative group">
                          <img 
                            src={challenge.image_url} 
                            alt="Frame preview" 
                            className="w-24 h-14 object-cover rounded border"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-white hover:bg-white/20"
                              onClick={() => handleGenerateFrameImage(challenge.id)}
                              disabled={generatingFrameImage === challenge.id}
                              title="Regenerate Frame Image"
                            >
                              {generatingFrameImage === challenge.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-white hover:bg-white/20"
                              onClick={() => copyFrameUrl(challenge.id)}
                              title="Copy Frame URL"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleGenerateFrameImage(challenge.id)}
                          disabled={generatingFrameImage === challenge.id}
                        >
                          {generatingFrameImage === challenge.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Wand2 className="h-3 w-3 mr-1" />
                          )}
                          Generate
                        </Button>
                      )}
                      <Button
                        variant="link"
                        size="sm"
                        className="h-5 text-xs p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => copyFrameUrl(challenge.id)}
                      >
                        <Copy className="h-2.5 w-2.5 mr-1" />
                        Copy URL
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-5 text-xs p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => copyGalxeUrl(challenge.id)}
                      >
                        <ClipboardCheck className="h-2.5 w-2.5 mr-1" />
                        Galxe API
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {challenge.wiki_entries && challenge.wiki_entries.length > 0 
                      ? challenge.wiki_entries.map(e => e.title).join(', ')
                      : challenge.wiki_entry?.title || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {challenge.total_prize_usdc}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {challenge.participation_count}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate">
                    {challenge.correct_answer || <span className="text-muted-foreground text-xs">Not set</span>}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(challenge)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(challenge.end_time), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const newValue = !(challenge as any).hide_prize_pool;
                        const { error } = await supabase
                          .from('challenges')
                          .update({ hide_prize_pool: newValue })
                          .eq('id', challenge.id);
                        if (!error) {
                          fetchChallenges();
                          toast({
                            title: newValue ? 'Prize Pool Hidden' : 'Prize Pool Visible',
                            description: `Prize pool info is now ${newValue ? 'hidden' : 'visible'} on challenges page.`,
                          });
                        }
                      }}
                      className={cn(
                        "h-7 px-2",
                        (challenge as any).hide_prize_pool ? "text-muted-foreground" : "text-green-600"
                      )}
                    >
                      {(challenge as any).hide_prize_pool ? (
                        <><EyeOff className="h-3 w-3 mr-1" />Hidden</>
                      ) : (
                        <><Eye className="h-3 w-3 mr-1" />Visible</>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* 참여자 목록 보기 버튼 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fetchParticipants(challenge)}
                        title="View Participants"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(challenge)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {/* 객관식 챌린지 종료 후 정답 미설정 시 정답 설정 버튼 표시 */}
                      {needsAnswerSetting(challenge) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSettingAnswerChallenge(challenge);
                            setSelectedAnswer('');
                          }}
                          title="Set Correct Answer"
                        >
                          <Check className="h-4 w-4 text-orange-500" />
                        </Button>
                      )}
                      {/* 챌린지 종료 후 당첨자 미선정 상태일 때 미리보기 버튼 표시 */}
                      {!challenge.selected_at && new Date(challenge.end_time) < new Date() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreviewWinnersClick(challenge)}
                          disabled={selectingWinners === challenge.id}
                          title="Preview Winners"
                        >
                          {selectingWinners === challenge.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          )}
                        </Button>
                      )}
                      {/* 챌린지 리뷰 페이지 링크 - 항상 표시 */}
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title={challenge.admin_approved_at ? "View Details" : "Review & Approve"}
                      >
                        <Link to={`/admin/challenge/${challenge.id}`}
                          aria-label={challenge.admin_approved_at ? "View Details" : "Review & Approve"}
                        >
                          <ClipboardCheck
                            className={cn(
                              "h-4 w-4",
                              challenge.admin_approved_at
                                ? "text-muted-foreground"
                                : challenge.selected_at
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            )}
                          />
                        </Link>
                      </Button>
                      {challenge.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setForceEndChallengeId(challenge.id)}
                          title="Force End Challenge"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {challenge.status === 'ended' && !challenge.selected_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setReactivateChallengeId(challenge.id)}
                          title="Reactivate Challenge"
                        >
                          <RotateCcw className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(challenge.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog 
          open={showCreateDialog || !!editingChallenge} 
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false);
              setEditingChallenge(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
              </DialogTitle>
              <DialogDescription>
                Set up a prediction challenge for fans to participate
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* 챌린지 타입 선택 */}
              <div className="space-y-2">
                <Label>Challenge Type *</Label>
                <Select 
                  value={challengeType} 
                  onValueChange={(value: ChallengeType) => setChallengeType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subjective">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Open-ended (Free text answer)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="multiple_choice">
                      <div className="flex items-center gap-2">
                        <ListOrdered className="h-4 w-4" />
                        <span>Multiple Choice (Select from options)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="youtube">
                      <div className="flex items-center gap-2">
                        <Youtube className="h-4 w-4" />
                        <span>YouTube Views (Predict view count)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 유튜브 챌린지 설정 */}
              {challengeType === 'youtube' && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-500" />
                    YouTube Video URL *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fetchYoutubeInfo(youtubeUrl)}
                      disabled={fetchingYoutubeInfo || !youtubeUrl.trim()}
                    >
                      {fetchingYoutubeInfo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1">Fetch</span>
                    </Button>
                  </div>
                  
                  {/* 유튜브 정보 미리보기 */}
                  {youtubeInfo && (
                    <div className="p-3 border rounded-lg bg-background space-y-2">
                      <div className="flex gap-3">
                        {youtubeInfo.thumbnail && (
                          <img 
                            src={youtubeInfo.thumbnail} 
                            alt={youtubeInfo.title}
                            className="w-32 h-auto rounded shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm line-clamp-2">{youtubeInfo.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{youtubeInfo.channelTitle}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {youtubeInfo.viewCount.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Views</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">
                            {youtubeInfo.likeCount?.toLocaleString() || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Likes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">
                            {youtubeInfo.commentCount?.toLocaleString() || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Comments</div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Fetched at: {new Date(youtubeInfo.fetchedAt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* 정답으로 사용할 데이터 타입 선택 */}
                  <div className="space-y-2">
                    <Label>Target Metric (Answer will be fetched at end time) *</Label>
                    <Select 
                      value={youtubeTargetMetric} 
                      onValueChange={handleYoutubeTargetMetricChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewCount">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span>View Count</span>
                            {youtubeInfo && <span className="text-muted-foreground ml-1">({youtubeInfo.viewCount.toLocaleString()})</span>}
                          </div>
                        </SelectItem>
                        <SelectItem value="likeCount" disabled={!youtubeInfo?.likeCount}>
                          <div className="flex items-center gap-2">
                            <span>👍</span>
                            <span>Like Count</span>
                            {youtubeInfo?.likeCount && <span className="text-muted-foreground ml-1">({youtubeInfo.likeCount.toLocaleString()})</span>}
                          </div>
                        </SelectItem>
                        <SelectItem value="commentCount" disabled={!youtubeInfo?.commentCount}>
                          <div className="flex items-center gap-2">
                            <span>💬</span>
                            <span>Comment Count</span>
                            {youtubeInfo?.commentCount && <span className="text-muted-foreground ml-1">({youtubeInfo.commentCount.toLocaleString()})</span>}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 정답 확인 시점 */}
                  <div className="space-y-2">
                    <Label>Answer Fetch Time (When to get the answer) *</Label>
                    <Input
                      type="datetime-local"
                      value={form.answer_fetch_time}
                      onChange={(e) => handleAnswerFetchTimeChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The system will automatically fetch the YouTube {youtubeTargetMetric === 'viewCount' ? 'view count' : youtubeTargetMetric === 'likeCount' ? 'like count' : 'comment count'} at this exact time and set it as the correct answer.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Question *</Label>
                <Textarea
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder={
                    challengeType === 'multiple_choice' 
                      ? "e.g., Which group will be #1 on Music Bank this week?"
                      : challengeType === 'youtube'
                      ? "e.g., What will be the view count of this MV on Sunday 12:00 PM?"
                      : "e.g., What song will be the debut title track?"
                  }
                />
              </div>

              {/* 객관식 옵션 설정 */}
              {challengeType === 'multiple_choice' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Options (Select artists for each position) *</Label>
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {multipleChoiceOptions.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Badge variant="secondary" className="shrink-0 w-12 justify-center">
                          {option.label}
                        </Badge>
                        
                        <div className="flex-1">
                          {option.wiki_entry ? (
                            <div className="flex items-center gap-2 bg-primary/10 px-2 py-1 rounded">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={option.wiki_entry.image_url || ''} />
                                <AvatarFallback className="text-xs">{option.wiki_entry.title?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{option.wiki_entry.title}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 ml-auto"
                                onClick={() => setOptionWikiEntry(option.id, null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Popover 
                                open={activeOptionPopover === option.id}
                                onOpenChange={(open) => setActiveOptionPopover(open ? option.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="shrink-0">
                                    <Search className="h-3 w-3 mr-1" /> Artist
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent portalled={false} className="w-[300px] p-0 z-[60]" align="start">
                                  <div className="p-2 border-b">
                                    <Input
                                      placeholder="Search artist..."
                                      value={optionSearchQueries[option.id] || ''}
                                      onChange={(e) => setOptionSearchQueries(prev => ({
                                        ...prev,
                                        [option.id]: e.target.value
                                      }))}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto p-1">
                                    {getFilteredEntriesForOption(option.id).map((entry) => (
                                      <div
                                        key={entry.id}
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-muted"
                                        onClick={() => setOptionWikiEntry(option.id, entry)}
                                      >
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={entry.image_url || ''} />
                                          <AvatarFallback className="text-xs">{entry.title?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{entry.title}</span>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <span className="text-muted-foreground text-sm self-center">or</span>
                              <Input
                                value={option.text || ''}
                                onChange={(e) => setOptionText(option.id, e.target.value)}
                                placeholder="Enter text..."
                                className="h-8 flex-1"
                              />
                            </div>
                          )}
                        </div>
                        
                        {multipleChoiceOptions.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeOption(option.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 정답 설정 - 종료 후에만 입력 */}
              <div className="space-y-2">
                <Label>
                  Correct Answer 
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    (Set after challenge ends to select winners)
                  </span>
                </Label>
                {challengeType === 'multiple_choice' ? (
                  <Select 
                    value={form.correct_answer} 
                    onValueChange={(value) => setForm({ ...form, correct_answer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer after results are known" />
                    </SelectTrigger>
                    <SelectContent>
                      {multipleChoiceOptions.filter(opt => opt.wiki_entry_id || opt.text?.trim()).map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}: {opt.wiki_entry?.title || opt.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.correct_answer}
                    onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
                    placeholder="Enter correct answer after result is known"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Leave empty when creating. Set the answer after the challenge ends to select winners.
                </p>
              </div>

              {/* 챌린지 모드 (공개/테스트) */}
              <div className="space-y-2">
                <Label>Challenge Mode</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: 'active' | 'test') => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-green-500" />
                        <span>Public (visible to all users)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="test">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4 text-amber-500" />
                        <span>Test Mode (admin only, Frame URL accessible)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.status === 'test' && (
                  <p className="text-xs text-amber-500">
                    🧪 Test mode: This challenge won't appear in the public list. Share the Frame URL directly for testing.
                  </p>
                )}
              </div>

              {/* 참여 비용 (스타 포인트) */}
              <div className="space-y-2">
                <Label>Entry Cost (Stars)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={form.entry_cost}
                    onChange={(e) => setForm({ ...form, entry_cost: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">Stars to participate</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set to 0 for free participation. Users must have enough Stars to join.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Limit Participation to Fans of (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select artists whose fans can participate. If none selected, anyone can participate.
                </p>
                
                {/* 선택된 아티스트 목록 */}
                {selectedWikiEntries.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedWikiEntries.map((entry) => (
                      <Badge key={entry.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={entry.image_url || ''} alt={entry.title} />
                          <AvatarFallback className="text-xs">{entry.title?.[0]}</AvatarFallback>
                        </Avatar>
                        <span>{entry.title}</span>
                        <button
                          type="button"
                          onClick={() => removeWikiEntry(entry.id)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                <Popover open={wikiPopoverOpen} onOpenChange={setWikiPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={wikiPopoverOpen}
                      className="w-full justify-between"
                    >
                      <span className="text-muted-foreground">
                        {selectedWikiEntries.length > 0 
                          ? `Add more artists (${selectedWikiEntries.length} selected)`
                          : 'Search and select artists...'}
                      </span>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent portalled={false} className="w-[400px] p-0 z-[60]" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search artist or member..."
                        value={wikiSearchQuery}
                        onChange={(e) => setWikiSearchQuery(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {filteredWikiEntries.map((entry) => {
                        const isSelected = selectedWikiEntries.some(e => e.id === entry.id);
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              "flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-muted",
                              isSelected && "bg-primary/10"
                            )}
                            onClick={() => toggleWikiEntry(entry)}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.image_url || ''} alt={entry.title} />
                              <AvatarFallback className="text-xs">
                                {entry.title?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1">
                              <span className="font-medium">{entry.title}</span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {entry.schema_type}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        );
                      })}
                      {filteredWikiEntries.length === 0 && wikiSearchQuery && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No results found
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Challenge Media (Optional)</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant={mediaType === 'image' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setMediaType('image'); setVideoUrl(''); }}
                  >
                    <ImagePlus className="h-4 w-4 mr-1" /> Image
                  </Button>
                  <Button
                    type="button"
                    variant={mediaType === 'video' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setMediaType('video'); setImageFile(null); setImagePreview(null); }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" /> YouTube
                  </Button>
                </div>
                
                {mediaType === 'video' ? (
                  <div className="space-y-2">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                    />
                    {videoUrl && isValidYouTubeUrl(videoUrl) && (
                      <div className="relative w-full max-w-xs aspect-video">
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(videoUrl)}`}
                          className="w-full h-full rounded-lg border"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {videoUrl && !isValidYouTubeUrl(videoUrl) && (
                      <p className="text-xs text-destructive">Invalid YouTube URL</p>
                    )}
                  </div>
                ) : (imagePreview || form.image_url) ? (
                  <div className="relative w-full max-w-xs">
                    <img 
                      src={imagePreview || form.image_url} 
                      alt="Challenge preview" 
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={removeImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload image</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              {/* 순위별 상금 설정 */}
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    <Label className="font-semibold">Prize Distribution by Rank</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Max Total: <span className="font-medium text-foreground">${calculateTotalPrize()} USDC</span>
                    </span>
                    <Button variant="outline" size="sm" onClick={addPrizeTier}>
                      <Plus className="h-3 w-3 mr-1" /> Add Rank
                    </Button>
                  </div>
                </div>
                
                {/* 헤더 */}
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium">
                  <div className="w-14">Rank</div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span>🎐</span> With Lightstick
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🎫</span> Without Lightstick
                    </div>
                  </div>
                  <div className="w-24 text-center">Winners</div>
                  <div className="w-7"></div>
                </div>
                
                <div className="space-y-2">
                  {prizeTiers.map((tier) => (
                    <div key={tier.rank} className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 w-14 justify-center">
                        {tier.rank}{getOrdinalSuffix(tier.rank)}
                      </Badge>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={tier.amountWithLightstick}
                            onChange={(e) => updatePrizeTier(tier.rank, 'amountWithLightstick', Number(e.target.value))}
                            className="h-8"
                            min={0}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={tier.amountWithoutLightstick}
                            onChange={(e) => updatePrizeTier(tier.rank, 'amountWithoutLightstick', Number(e.target.value))}
                            className="h-8"
                            min={0}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 w-24">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={tier.count}
                          onChange={(e) => updatePrizeTier(tier.rank, 'count', Math.max(1, Number(e.target.value)))}
                          className="h-8 w-16"
                          min={1}
                        />
                      </div>
                      {prizeTiers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removePrizeTier(tier.rank)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {calculateTotalWinners()} winner(s) total. Winners with lightstick receive bonus prizes.
                </p>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Start</Label>
                  <Input
                    type="datetime-local"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to start immediately
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Entry Deadline *</Label>
                  <Input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingChallenge(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingChallenge ? handleUpdate : handleCreate}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingChallenge ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Participants Dialog */}
        <Dialog 
          open={!!viewingParticipants} 
          onOpenChange={(open) => {
            if (!open) {
              setViewingParticipants(null);
              setParticipants([]);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </DialogTitle>
              <DialogDescription className="truncate">
                {viewingParticipants?.question}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-[60vh]">
              {loadingParticipants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : participants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No participants yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Answer</TableHead>
                      <TableHead>Lightstick</TableHead>
                      <TableHead>Winner</TableHead>
                      <TableHead>Prize</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow key={participant.id} className={participant.is_winner ? 'bg-green-50 dark:bg-green-950/30' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={participant.profile?.avatar_url || ''} />
                              <AvatarFallback>
                                {(participant.profile?.display_name || participant.profile?.username || '?')[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">
                                {participant.profile?.display_name || participant.profile?.username || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{participant.profile?.username || participant.user_id.slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {participant.source === 'external' ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              Farcaster
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              K-Trendz
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate">
                            {viewingParticipants ? getAnswerDisplay(participant.answer, viewingParticipants) : participant.answer}
                          </div>
                        </TableCell>
                        <TableCell>
                          {participant.has_lightstick ? (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              <Gift className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {participant.is_winner === true ? (
                            <Badge className="bg-green-500">
                              <Trophy className="h-3 w-3 mr-1" />
                              Winner
                            </Badge>
                          ) : participant.is_winner === false ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {participant.prize_amount ? (
                            <span className="font-medium text-green-600">
                              ${participant.prize_amount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(participant.created_at), 'MM/dd HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* 당첨자 미리보기 다이얼로그 */}
        <Dialog open={!!previewingWinners} onOpenChange={(open) => !open && setPreviewingWinners(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Winner Preview
              </DialogTitle>
              <DialogDescription>
                {previewingWinners?.question}
              </DialogDescription>
            </DialogHeader>
            
            {loadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : winnerPreviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No correct answers found. No winners to select.
              </div>
            ) : (
              <>
                {/* 블록체인 정보 */}
                {previewSelection && (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block Number:</span>
                      <span className="font-mono">{previewSelection.block_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Correct Answers:</span>
                      <span>{previewSelection.total_correct_answers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selected Winners:</span>
                      <span className="font-semibold text-purple-600">{winnerPreviews.length}</span>
                    </div>
                  </div>
                )}

                {/* 당첨자 목록 */}
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Answer</TableHead>
                        <TableHead>Lightstick</TableHead>
                        <TableHead>Prize</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {winnerPreviews.map((winner, idx) => (
                        <TableRow key={winner.user_id + idx}>
                          <TableCell>
                            <Badge variant="outline" className="font-semibold">
                              {winner.rank === 1 ? '🥇 1st' : 
                               winner.rank === 2 ? '🥈 2nd' : 
                               winner.rank === 3 ? '🥉 3rd' : 
                               `${winner.rank}th`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={winner.avatar_url || undefined} />
                                <AvatarFallback>
                                  {(winner.display_name || winner.username || '?')[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">
                                  {winner.display_name || winner.username}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  @{winner.username}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <div className="truncate text-sm">
                              {previewingWinners ? getAnswerDisplay(winner.answer, previewingWinners) : winner.answer}
                            </div>
                          </TableCell>
                          <TableCell>
                            {winner.has_lightstick ? (
                              <Gift className="h-4 w-4 text-purple-500" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              ${winner.prize_amount}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setPreviewingWinners(null)}>
                Cancel
              </Button>
              {winnerPreviews.length > 0 && (
                <Button 
                  onClick={handleConfirmWinners}
                  disabled={selectingWinners !== null}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {selectingWinners ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Announcing...
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4 mr-2" />
                      Confirm & Announce Winners
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Force End 확인 대화상자 */}
        <AlertDialog open={!!forceEndChallengeId} onOpenChange={(open) => !open && setForceEndChallengeId(null)}>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Force End Challenge</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to force end this challenge? This action cannot be undone and will immediately close the challenge for all participants.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (forceEndChallengeId) {
                    handleEndChallenge(forceEndChallengeId);
                    setForceEndChallengeId(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Force End
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reactivate 확인 대화상자 */}
        <AlertDialog open={!!reactivateChallengeId} onOpenChange={(open) => !open && setReactivateChallengeId(null)}>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Reactivate Challenge</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reactivate this challenge? It will become active again and participants can continue voting.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (reactivateChallengeId) {
                    handleReactivateChallenge(reactivateChallengeId);
                    setReactivateChallengeId(null);
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Reactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 챌린지 승인 대화상자 */}
        <Dialog open={!!approvingChallenge} onOpenChange={(open) => !open && setApprovingChallenge(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Challenge Winners</DialogTitle>
              <DialogDescription>
                Set the claim period for winners to receive their prizes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Claim Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={approvalClaimStartTime}
                  onChange={(e) => setApprovalClaimStartTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Winners can start claiming prizes after this time
                </p>
              </div>
              <div className="space-y-2">
                <Label>Claim End Time (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={approvalClaimEndTime}
                  onChange={(e) => setApprovalClaimEndTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no deadline
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setApprovingChallenge(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveChallenge}
                disabled={isApproving || !approvalClaimStartTime}
                className="bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 객관식 정답 설정 다이얼로그 */}
        <Dialog open={!!settingAnswerChallenge} onOpenChange={(open) => !open && setSettingAnswerChallenge(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>Set Correct Answer</DialogTitle>
              <DialogDescription>
                Select the correct answer for this challenge. This will determine who the winners are.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {settingAnswerChallenge && (
                <>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{settingAnswerChallenge.question}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Correct Answer *</Label>
                    {(() => {
                      const options = settingAnswerChallenge.options as any;
                      if (options?.items) {
                        return (
                          <div className="space-y-2">
                            {options.items.map((item: any) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                                  selectedAnswer === item.id
                                    ? "border-primary bg-primary/10"
                                    : "hover:bg-muted"
                                )}
                                onClick={() => setSelectedAnswer(item.id)}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                  selectedAnswer === item.id
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground"
                                )}>
                                  {selectedAnswer === item.id && (
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium">{item.label}:</span>{' '}
                                  <span>{item.wiki_entry_title || item.text || `Option ${item.id}`}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-muted-foreground">No options found</p>;
                    })()}
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setSettingAnswerChallenge(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSetAnswer}
                disabled={isSettingAnswer || !selectedAnswer}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSettingAnswer ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Set Answer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* YouTube 챌린지 프리뷰 타겟 값 입력 다이얼로그 */}
        <Dialog open={!!showPreviewTargetDialog} onOpenChange={(open) => !open && setShowPreviewTargetDialog(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>Preview Winners</DialogTitle>
              <DialogDescription>
                Enter the current view count to preview winners based on proximity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {showPreviewTargetDialog && (
                <>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{showPreviewTargetDialog.question}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Current View Count *</Label>
                    <Input
                      type="number"
                      value={previewTargetValue}
                      onChange={(e) => setPreviewTargetValue(e.target.value)}
                      placeholder="e.g., 780022"
                    />
                    <p className="text-xs text-muted-foreground">
                      Winners will be ranked by how close their answer is to this value.
                    </p>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreviewTargetDialog(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => showPreviewTargetDialog && handlePreviewWinners(showPreviewTargetDialog, previewTargetValue)}
                disabled={!previewTargetValue || loadingPreview}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Preview Winners
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
