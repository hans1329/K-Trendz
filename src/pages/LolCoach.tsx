import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, MessageCircle, ChevronRight, Sword, Shield, Star, Zap, Eye, Target, TrendingUp, Crosshair, HelpCircle, X, DollarSign, BarChart3, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown, Volume2, VolumeX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LolMissionPanel } from "@/components/lol/LolMissionPanel";
import LolProfileCard from "@/components/lol/LolProfileCard";

// 이미지 임포트
import lolBackground from "@/assets/lol/lol-background.jpg";
import user1Avatar from "@/assets/lol/user1-avatar.jpg";
import user2Avatar from "@/assets/lol/user2-avatar.jpg";
import user3Avatar from "@/assets/lol/user3-avatar.jpg";
import coachAvatar from "@/assets/lol/coach-avatar.webp";

// 샘플 유저 데이터
const sampleUsers = [
  {
    id: 1,
    name: "오늘부터 시작",
    avatar: user1Avatar,
    tier: "UNRANKED",
    tierIcon: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/unranked.png",
    level: 12,
    type: "Newcomer",
    description: "Fresh summoner ready to learn",
    stats: null,
    advancedStats: null,
    recentMatches: [],
    mostPlayed: [],
  },
  {
    id: 2,
    name: "초보 한석",
    avatar: user2Avatar,
    tier: "BRONZE II",
    tierIcon: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/bronze.png",
    level: 48,
    type: "Beginner",
    description: "Climbing through the ranks",
    stats: {
      wins: 45,
      losses: 67,
      winRate: 40.2,
      avgKDA: "3.2 / 7.8 / 5.1",
      avgCS: 98,
      avgVision: 12,
    },
    advancedStats: {
      earlyGame: { csd15: -12, gd15: -450, xpd15: -280, soloKills: 0.4 },
      combat: { kp: 48, dpm: 380, damageGoldRatio: 0.85, damageTakenPerDeath: 4200 },
      vision: { visionScore: 12, wpm: 0.28, wcpm: 0.12, objectiveControl: 35 },
      resource: { cspm: 4.8, gpm: 320 },
      radarData: [
        { stat: "Laning", value: 25, fullMark: 100 },
        { stat: "Combat", value: 35, fullMark: 100 },
        { stat: "Vision", value: 20, fullMark: 100 },
        { stat: "Farm", value: 40, fullMark: 100 },
        { stat: "Survival", value: 30, fullMark: 100 },
        { stat: "Objective", value: 25, fullMark: 100 },
      ],
    },
    recentMatches: [
      { champion: "Garen", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Garen.png", result: "DEFEAT", kda: "2/8/3", cs: 89 },
      { champion: "Ashe", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ashe.png", result: "VICTORY", kda: "5/4/12", cs: 112 },
      { champion: "Master Yi", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/MasterYi.png", result: "DEFEAT", kda: "6/9/2", cs: 78 },
      { champion: "Lux", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Lux.png", result: "DEFEAT", kda: "1/6/8", cs: 67 },
      { champion: "Garen", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Garen.png", result: "VICTORY", kda: "4/3/5", cs: 134 },
    ],
    mostPlayed: [
      { champion: "Garen", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Garen.png", games: 23, winRate: 48 },
      { champion: "Ashe", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ashe.png", games: 18, winRate: 39 },
      { champion: "Master Yi", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/MasterYi.png", games: 15, winRate: 33 },
    ],
  },
  {
    id: 3,
    name: "중수 상락",
    avatar: user3Avatar,
    tier: "GOLD I",
    tierIcon: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/gold.png",
    level: 156,
    type: "Intermediate",
    description: "Platinum bound summoner",
    stats: {
      wins: 234,
      losses: 198,
      winRate: 54.2,
      avgKDA: "5.8 / 4.2 / 8.3",
      avgCS: 178,
      avgVision: 28,
    },
    advancedStats: {
      earlyGame: { csd15: 8, gd15: 320, xpd15: 180, soloKills: 1.2 },
      combat: { kp: 68, dpm: 620, damageGoldRatio: 1.15, damageTakenPerDeath: 6800 },
      vision: { visionScore: 28, wpm: 0.52, wcpm: 0.35, objectiveControl: 62 },
      resource: { cspm: 7.8, gpm: 425 },
      radarData: [
        { stat: "Laning", value: 65, fullMark: 100 },
        { stat: "Combat", value: 72, fullMark: 100 },
        { stat: "Vision", value: 58, fullMark: 100 },
        { stat: "Farm", value: 75, fullMark: 100 },
        { stat: "Survival", value: 68, fullMark: 100 },
        { stat: "Objective", value: 62, fullMark: 100 },
      ],
    },
    recentMatches: [
      { champion: "Jinx", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jinx.png", result: "VICTORY", kda: "12/2/8", cs: 245 },
      { champion: "Kai'Sa", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Kaisa.png", result: "VICTORY", kda: "8/3/11", cs: 198 },
      { champion: "Ezreal", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ezreal.png", result: "DEFEAT", kda: "4/5/7", cs: 167 },
      { champion: "Jinx", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jinx.png", result: "VICTORY", kda: "15/4/6", cs: 278 },
      { champion: "Vayne", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Vayne.png", result: "DEFEAT", kda: "6/6/4", cs: 189 },
    ],
    mostPlayed: [
      { champion: "Jinx", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jinx.png", games: 89, winRate: 58 },
      { champion: "Kai'Sa", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Kaisa.png", games: 67, winRate: 52 },
      { champion: "Ezreal", championIcon: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ezreal.png", games: 45, winRate: 49 },
    ],
  },
];

// 분석 지표 설명 데이터
const metricsInfo = {
  earlyGame: {
    title: "Early Game (Laning Phase)",
    description: "Measures how well you establish early game dominance, typically at 10-15 minutes.",
    metrics: [
      { name: "CSD@15", desc: "CS Difference at 15min - Your CS lead/deficit vs lane opponent" },
      { name: "GD@15", desc: "Gold Difference at 15min - Gold advantage over opponent" },
      { name: "XPD@15", desc: "Experience Difference at 15min - Level/exp advantage" },
      { name: "Solo Kills", desc: "Kills without ally assistance (1v1 outplay indicator)" },
    ]
  },
  combat: {
    title: "Combat & Teamfight",
    description: "Evaluates your efficiency in combat situations and teamfights.",
    metrics: [
      { name: "KP%", desc: "Kill Participation - % of team kills you contributed to" },
      { name: "DPM", desc: "Damage Per Minute - Average damage output" },
      { name: "DMG/Gold", desc: "Damage efficiency relative to gold earned" },
      { name: "Taken/Death", desc: "Damage absorbed before dying (tank efficiency)" },
    ]
  },
  vision: {
    title: "Vision & Map Control",
    description: "Measures your information gathering and map awareness.",
    metrics: [
      { name: "Vision Score", desc: "Combined ward placement, clearing, and vision control" },
      { name: "WPM", desc: "Wards Placed Per Minute" },
      { name: "WCPM", desc: "Wards Cleared Per Minute" },
      { name: "Objective Rate", desc: "Contribution to Dragon, Baron, Herald objectives" },
    ]
  },
  resource: {
    title: "Resource Efficiency",
    description: "Measures consistent gold and CS generation throughout the game.",
    metrics: [
      { name: "CSPM", desc: "CS Per Minute - Target: 8-10+ for carries" },
      { name: "GPM", desc: "Gold Per Minute - Overall income rate" },
    ]
  }
};

type ViewMode = "select" | "detail" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  type?: "normal" | "celebration";
  feedback?: "up" | "down" | null;
}

// 분석 지표 도움말 컴포넌트
const MetricsHelpPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="p-2 text-[#C89B3C] hover:text-[#F0E6D2] transition-colors">
        <HelpCircle className="w-5 h-5" />
      </button>
    </PopoverTrigger>
    <PopoverContent 
      className="w-80 md:w-96 bg-[#0A0E13] border border-[#463714] p-0 max-h-[70vh] overflow-auto"
      side="bottom"
      align="start"
    >
      <div className="p-4 border-b border-[#463714]">
        <h3 className="text-[#C89B3C] font-semibold tracking-wider">ANALYSIS METRICS GUIDE</h3>
        <p className="text-[#5B5A56] text-xs mt-1">Understanding the key performance indicators</p>
      </div>
      <div className="p-4 space-y-4">
        {Object.entries(metricsInfo).map(([key, section]) => (
          <div key={key}>
            <h4 className="text-[#0AC8B9] text-sm font-medium mb-1">{section.title}</h4>
            <p className="text-[#5B5A56] text-xs mb-2">{section.description}</p>
            <div className="space-y-1.5">
              {section.metrics.map((metric) => (
                <div key={metric.name} className="bg-[#1E2328] rounded p-2">
                  <span className="text-[#F0E6D2] text-xs font-medium">{metric.name}</span>
                  <p className="text-[#A09B8C] text-xs mt-0.5">{metric.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

// GPT-4o-mini 가격 (2024년 기준)
const GPT4O_MINI_PRICING = {
  input: 0.15 / 1_000_000,  // $0.15 per 1M input tokens
  output: 0.60 / 1_000_000, // $0.60 per 1M output tokens
};

// ElevenLabs 가격 (Creator 플랜 기준)
const ELEVENLABS_PRICING = {
  per_char: 0.22 / 1000, // $0.22 per 1K characters
};

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  cost: number;
  tts_chars: number;
  tts_cost: number;
}

const LolCoach = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("select");
  const [selectedUser, setSelectedUser] = useState<typeof sampleUsers[0] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, cost: 0, tts_chars: 0, tts_cost: 0 });
  const [showUsagePanel, setShowUsagePanel] = useState(false);
  const [profileCardTarget, setProfileCardTarget] = useState<{ isCoach: boolean } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsUnlocked, setTtsUnlocked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [displayedContent, setDisplayedContent] = useState("");
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // 무음 오디오 (모바일 브라우저 오디오 정책 unlock 용)
  const SILENT_WAV_DATA_URI =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  // 모바일 오디오 정책 대응: 실제 재생에 사용할 audioRef를 사용자 제스처로 "unlock"
  const unlockTTS = () => {
    if (ttsUnlocked) return;

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;

    audio.muted = true;
    audio.src = SILENT_WAV_DATA_URI;

    console.log('[TTS] unlocking audio...');
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        setTtsUnlocked(true);
        console.log('[TTS] unlocked');
      })
      .catch((err) => {
        console.log('[TTS] unlock failed', err);
        // 알림 표시하지 않음 - 사용자가 TTS를 켜지 않았을 수도 있음
      })
      .finally(() => {
        audio.muted = false;
      });
  };

  // 현재 로그인 유저 가져오기 + TTS 설정 불러오기
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      if (user?.id) {
        // 로그인 사용자: DB에서 TTS 설정 불러오기
        const { data: profile } = await supabase
          .from('profiles')
          .select('lol_tts_enabled')
          .eq('id', user.id)
          .single();
        
        if (profile?.lol_tts_enabled !== undefined) {
          setTtsEnabled(profile.lol_tts_enabled);
        }
      } else {
        // 비로그인 사용자: localStorage에서 불러오기
        const savedTts = localStorage.getItem('lol_tts_enabled');
        if (savedTts !== null) {
          setTtsEnabled(savedTts === 'true');
        }
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // TTS 재생 함수 (await 없이 호출해서 메시지와 동시에 시작)
  // TTS 오디오 준비 함수 - 오디오 객체 반환 (재생 전)
  const prepareTTS = async (text: string): Promise<HTMLAudioElement | null> => {
    // 마크다운 스타일 텍스트 제거
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/•/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    
    if (!cleanText) return null;

    // TTS 비용 추적
    const charCount = cleanText.length;
    const ttsCost = charCount * ELEVENLABS_PRICING.per_char;
    setTokenUsage(prev => ({
      ...prev,
      tts_chars: prev.tts_chars + charCount,
      tts_cost: prev.tts_cost + ttsCost,
    }));

    // 이전 오디오 정지 + 기존 objectURL 해제
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    try {
      console.log('[TTS] request start, chars:', charCount);
      const response = await fetch(
        `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/elevenlabs-tts-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      console.log('[TTS] response', response.status);

      if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      // IMPORTANT: unlock 된 동일한 audio element를 재사용해야 모바일에서 재생이 안정적
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = audioUrl;
      audio.volume = 1.0; // 최대 볼륨
      audio.preload = 'auto';
      
      audio.onended = () => {
        setIsSpeaking(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      
      return audio;
    } catch (error) {
      console.error('TTS error:', error);
      return null;
    }
  };

  // TTS 재생 함수
  const playTTS = async (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    setIsSpeaking(true);
    try {
      console.log('[TTS] play()');
      await audio.play();
    } catch (error) {
      console.error('TTS play error:', error);
      setIsSpeaking(false);
    }
  };

  // 오디오 metadata 로딩 전에는 duration이 0/NaN일 수 있어서 안전하게 기다린 뒤 가져오기
  const getAudioDurationSeconds = async (audio: HTMLAudioElement | null): Promise<number> => {
    if (!audio) return 0;
    if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;

    // metadata 계산이 긴 오디오에서는 오래 걸릴 수 있어 폴링으로 안정적으로 기다림
    try {
      // 일부 브라우저에서 duration 산출을 촉진
      audio.load?.();
    } catch {
      // 무시
    }

    const timeoutMs = 8000;
    const start = Date.now();

    // 이벤트 한번 기다리고, 이후 폴링
    await Promise.race([
      new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener('loadedmetadata', done, { once: true });
        audio.addEventListener('durationchange', done, { once: true });
        audio.addEventListener('canplay', done, { once: true });
        audio.addEventListener('error', done, { once: true });
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 500)),
    ]);

    while (Date.now() - start < timeoutMs) {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) return d;
      await new Promise((r) => setTimeout(r, 100));
    }

    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  };

  // TTS 정지 함수
  const stopTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  };

  // 타이핑 효과 시작 (TTS와 동기화 - 오디오 진행시간 기반)
  const startTypingEffect = (
    fullText: string,
    messageIndex: number,
    audioDuration?: number,
    audio?: HTMLAudioElement | null
  ) => {
    // 기존 타이핑 중지
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    let currentIndex = 0;

    // 타이핑 속도 계산은 "실제로 읽히는 텍스트" 기준으로 (마크다운 토큰 제거)
    // 실제로 타이핑되는 동안에는 plain 텍스트로 보여주고, 완료 시 원본(fullText)로 교체
    const typingSourceText = fullText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/•/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    const typingLength = typingSourceText.length;

    // 오디오 duration이 있으면 그에 맞춰 타이핑 전체 시간을 맞추고,
    // 메시지 길이에 따라 interval이 과하게 줄어들지 않도록(=길수록 더 빨라지는 느낌 방지)
    // tick 단위로 몇 글자씩 찍을지(charsPerTick)로 제어
    const targetDurationMs = audioDuration && audioDuration > 0
      ? audioDuration * 1000 * 1.6 // 음성보다 확실히 느리게(텍스트가 '앞서간다' 체감 방지)
      : 12000;

    const tickMs = 35;
    const startMs = performance.now();
    let lastIndex = 0;

    typingIntervalRef.current = setInterval(() => {
      const useAudioProgress = !!audio && Number.isFinite(audio.duration) && audio.duration > 0 && !audio.paused;
      const progress = useAudioProgress
        ? Math.min(1, audio!.currentTime / audio!.duration)
        : Math.min(1, (performance.now() - startMs) / targetDurationMs);

      const nextIndex = Math.min(typingLength, Math.floor(progress * typingLength));
      lastIndex = Math.max(lastIndex, nextIndex);
      currentIndex = lastIndex;

      const partialText = typingSourceText.slice(0, currentIndex);
      setDisplayedContent(partialText);
      
      const isDone = currentIndex >= typingLength || (audio?.ended ?? false);

      // 메시지 배열도 업데이트 (완료 시에는 원본 텍스트로 교체해서 포맷 유지)
      setMessages(prev => prev.map((msg, idx) =>
        idx === messageIndex ? { ...msg, content: isDone ? fullText : partialText } : msg
      ));
      
      if (isDone) {
        // 완료
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setTypingMessageIndex(null);
        setDisplayedContent("");
      }
    }, tickMs);
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  // 메시지 피드백 핸들러
  const handleFeedback = (messageIndex: number, feedback: "up" | "down") => {
    setMessages(prev => prev.map((msg, idx) => {
      if (idx === messageIndex) {
        // 같은 버튼 다시 누르면 취소
        const newFeedback = msg.feedback === feedback ? null : feedback;
        return { ...msg, feedback: newFeedback };
      }
      return msg;
    }));
    
    if (feedback === "up") {
      toast({ title: "👍 피드백 감사합니다!", description: "더 좋은 답변을 드릴게요." });
    } else {
      toast({ title: "👎 피드백 감사합니다!", description: "개선할 수 있도록 노력할게요." });
    }
  };

  const handleSelectUser = (user: typeof sampleUsers[0]) => {
    setSelectedUser(user);
    setViewMode("detail");
  };

  const handleStartChat = async () => {
    if (!selectedUser) return;
    setViewMode("chat");
    setIsLoading(true);

    // 샘플 유저 키 결정
    const sampleUserKey = selectedUser.id === 1 ? 'beginner' : selectedUser.id === 2 ? 'bronze' : 'gold';

    try {
      // 이전 대화 불러오기 (로그인 유저만)
      if (!currentUserId) {
        // 비로그인 시 새로운 환영 메시지로 시작
        const initialMessage: ChatMessage = {
          role: "assistant",
          content: getWelcomeMessage(selectedUser),
        };
        setMessages([initialMessage]);
        setIsLoading(false);
        return;
      }

      const { data: sessions, error: sessionError } = await supabase
        .from('lol_chat_sessions')
        .select('id')
        .eq('sample_user_key', sampleUserKey)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionError) throw sessionError;

      if (sessions && sessions.length > 0) {
        const existingSessionId = sessions[0].id;
        setDbSessionId(existingSessionId);

        // 해당 세션의 메시지 불러오기
        const { data: messagesData, error: messagesError } = await supabase
          .from('lol_chat_messages')
          .select('role, content, feedback, message_type')
          .eq('session_id', existingSessionId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        if (messagesData && messagesData.length > 0) {
          const loadedMessages: ChatMessage[] = messagesData.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            feedback: msg.feedback as 'up' | 'down' | null,
            type: (msg.message_type as 'normal' | 'celebration') || 'normal',
          }));
          setMessages(loadedMessages);
          toast({ title: "이전 대화를 불러왔어요! 💬", description: `${loadedMessages.length}개의 메시지` });
          setIsLoading(false);
          return;
        }
      }

      // 이전 대화가 없으면 새로운 환영 메시지
      const initialMessage: ChatMessage = {
        role: "assistant",
        content: getWelcomeMessage(selectedUser),
      };
      setMessages([initialMessage]);
    } catch (error) {
      console.error('Error loading chat history:', error);
      // 에러 시에도 환영 메시지로 시작
      const initialMessage: ChatMessage = {
        role: "assistant",
        content: getWelcomeMessage(selectedUser),
      };
      setMessages([initialMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getWelcomeMessage = (user: typeof sampleUsers[0]) => {
    if (user.id === 1) {
      return `반가워, ${user.name}! 👋\n\n롤에 온 걸 환영해~ 처음이라 막막할 수 있는데, 걱정 마! 내가 하나씩 알려줄게.\n\n지금 레벨 ${user.level}이니까, 우선 이런 것들부터 시작해봐:\n\n🎯 쉽고 재밌는 챔피언 추천\n🗺️ 미니맵 보는 습관 들이기\n⚔️ 미니언 막타(CS) 연습하기\n\n어떤 부분을 더 잘하고 싶어?`;
    } else if (user.id === 2) {
      const stats = user.advancedStats;
      return `반가워, ${user.name}! 👋\n\n${user.tier} 데이터를 살펴봤는데, 같이 분석해볼게!\n\n📊 라인전 분석\n• 15분 기준 CS가 상대보다 ${Math.abs(stats?.earlyGame.csd15 || 0)}개 부족해\n• 골드도 ${Math.abs(stats?.earlyGame.gd15 || 0)}원 정도 뒤처지고 있어\n→ 미니언 막타를 좀 더 챙기면 라인전이 훨씬 편해질 거야!\n\n⚔️ 전투 분석\n• 팀 킬의 ${stats?.combat.kp}%에 참여하고 있어\n• 분당 ${stats?.combat.dpm} 데미지를 넣고 있어\n→ 팀 싸움 합류 타이밍을 조금만 빠르게 하면 좋겠어!\n\n👁️ 시야 분석\n• 와드를 분당 ${stats?.vision.wpm}개 설치 중이야\n→ 리콜할 때 핑크와드 꼭 챙겨봐!\n\n어떤 부분을 더 잘하고 싶어?`;
    } else {
      const stats = user.advancedStats;
      return `반가워, ${user.name}! 👋\n\n${user.tier}구나! 데이터 보니까 기본기가 정말 탄탄하네~ 👍\n\n📊 라인전 분석\n• 15분 기준 CS가 상대보다 ${stats?.earlyGame.csd15}개 앞서 있어\n• 골드도 ${stats?.earlyGame.gd15}원 이득 보고 있어\n→ 라인전 운영 잘 하고 있어!\n\n⚔️ 전투 분석\n• 팀 킬의 ${stats?.combat.kp}%에 참여하고 있어 (훌륭해!)\n• 분당 ${stats?.combat.dpm} 데미지로 딜 기여도도 높아\n\n👁️ 시야 분석\n• 비전 점수 ${stats?.vision.visionScore}점이야\n→ 여기만 조금 더 신경 쓰면 플래 갈 수 있어!\n\n🚀 플래티넘 가려면 와드 컨트롤이 핵심이야!\n\n어떤 부분을 더 잘하고 싶어?`;
    }
  };

  const getUserContext = (user: typeof sampleUsers[0]) => {
    if (!user.advancedStats) return `Brand new player, level ${user.level}. Teach basics.`;
    const s = user.advancedStats;
    return `${user.tier} player. Early: CSD@15 ${s.earlyGame.csd15}, GD@15 ${s.earlyGame.gd15}. Combat: ${s.combat.kp}% KP, ${s.combat.dpm} DPM. Vision: ${s.vision.visionScore} score, ${s.vision.wpm} WPM. Farm: ${s.resource.cspm} CSPM, ${s.resource.gpm} GPM. Mains: ${user.mostPlayed?.map(c => c.champion).join(', ')}.`;
  };

  const MAX_MESSAGE_LENGTH = 500;

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedUser || isLoading) return;

    // 프론트엔드 길이 검증
    if (inputMessage.length > MAX_MESSAGE_LENGTH) {
      toast({ 
        title: "메시지가 너무 길어요", 
        description: `${MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.`, 
        variant: "destructive" 
      });
      return;
    }

    // 모바일 브라우저 오디오 정책 unlock - 사용자 클릭 순간에 unlock
    if (ttsEnabled) {
      unlockTTS();
    }

    const userMessage: ChatMessage = { role: "user", content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // 샘플 유저 키 결정
    const sampleUserKey = selectedUser.id === 1 ? 'beginner' : selectedUser.id === 2 ? 'bronze' : 'gold';

    try {
      const { data, error } = await supabase.functions.invoke("lol-coach-chat", {
        body: {
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          userContext: getUserContext(selectedUser),
          sessionId,
          sampleUserKey,
          userId: currentUserId,
        },
      });
      
      // Edge function 에러 처리
      if (error) throw error;
      
      // 서버에서 반환된 에러 처리 (rate limit, profanity 등)
      if (data?.error) {
        toast({ 
          title: data.error === 'rate_limit' ? '⏰ 잠깐 쉬었다 가자!' 
               : data.error === 'profanity_detected' ? '🙏 표현을 수정해줘!'
               : data.error === 'message_too_long' ? '📝 메시지가 너무 길어!'
               : '오류', 
          description: data.message,
          variant: "destructive" 
        });
        // 유저 메시지 롤백
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      // DB 세션 ID 저장
      if (data?.dbSessionId && !dbSessionId) {
        setDbSessionId(data.dbSessionId);
      }
      
      // 토큰 사용량 업데이트 (캐싱 정보 포함)
      if (data?.usage) {
        const newPrompt = data.usage.prompt_tokens || 0;
        const newCompletion = data.usage.completion_tokens || 0;
        const newCached = data.usage.cached_tokens || 0;
        
        // 캐시된 토큰은 50% 할인 적용
        const uncachedPrompt = newPrompt - newCached;
        const cachedCost = newCached * GPT4O_MINI_PRICING.input * 0.5;
        const uncachedCost = uncachedPrompt * GPT4O_MINI_PRICING.input;
        const newCost = cachedCost + uncachedCost + (newCompletion * GPT4O_MINI_PRICING.output);
        
        setTokenUsage(prev => ({
          prompt_tokens: prev.prompt_tokens + newPrompt,
          completion_tokens: prev.completion_tokens + newCompletion,
          total_tokens: prev.total_tokens + (data.usage.total_tokens || 0),
          cached_tokens: prev.cached_tokens + newCached,
          cost: prev.cost + newCost,
          tts_chars: prev.tts_chars,
          tts_cost: prev.tts_cost,
        }));
      }
      
      const assistantMessage = data.message;
      
      // TTS가 활성화된 경우: 타이핑 효과와 함께 오디오 재생
      if (ttsEnabled) {
        const audio = await prepareTTS(assistantMessage);
        // 빈 메시지로 시작
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);
        const newIndex = messages.length + 1; // +1 because we added user message
        setTypingMessageIndex(newIndex);
        setDisplayedContent("");
        
        // 오디오 duration을 가져와서 타이핑 속도와 동기화 (metadata 로딩 대기)
        const audioDuration = await getAudioDurationSeconds(audio);
        
        // 오디오가 실제로 재생 시작된 뒤에 타이핑을 시작해야 '음성보다 앞서가는' 체감이 줄어듦
        await playTTS(audio);
        startTypingEffect(assistantMessage, newIndex, audioDuration, audio);
      } else {
        // TTS 비활성화: 바로 메시지 표시
        setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      // 유저 메시지 롤백
      setMessages(prev => prev.slice(0, -1));
      toast({ title: "오류", description: "응답을 가져오는데 실패했어요. 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 분석 카드 컴포넌트
  const AnalysisCard = ({ title, icon: Icon, children, color }: { title: string; icon: any; children: React.ReactNode; color: string }) => (
    <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded">
      <div className="bg-[#0A0E13] rounded h-full">
        <div className={`h-1 ${color}`} />
        <div className="p-4">
          <h4 className="text-[#C89B3C] text-xs tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {title}
          </h4>
          {children}
        </div>
      </div>
    </div>
  );

  // 유저 선택 화면
  if (viewMode === "select") {
    return (
      <>
        <Helmet>
          <title>AI Coach - League of Legends</title>
          <meta name="description" content="AI-powered League of Legends coaching" />
        </Helmet>
        <div className="min-h-screen relative">
          {/* 배경 이미지 */}
          <div 
            className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${lolBackground})` }}
          >
            <div className="absolute inset-0 bg-[#010A13]/70" />
          </div>

          <div className="container max-w-5xl mx-auto px-4 py-12">
            {/* 헤더 */}
            <div className="text-center mb-12 animate-fade-in">
              <p className="text-[#0AC8B9] text-sm tracking-[0.3em] uppercase mb-3">Summoner Coach</p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-wide mb-4" style={{ color: '#F0E6D2' }}>
                AI COACHING
              </h1>
              <div className="w-24 h-1 mx-auto bg-gradient-to-r from-transparent via-[#C89B3C] to-transparent" />
              <p className="text-[#A09B8C] mt-6 text-lg">Select a summoner profile to begin your session</p>
            </div>

            {/* 유저 카드 그리드 */}
            <div className="grid gap-6 md:grid-cols-3">
              {sampleUsers.map((user, idx) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="group cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="relative p-[1px] bg-gradient-to-b from-[#785A28] via-[#463714] to-[#785A28] rounded">
                    <div className="bg-[#010A13]/95 backdrop-blur rounded overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-[#463714] via-[#C89B3C] to-[#463714]" />
                      <div className="p-6">
                        {/* 프로필 이미지 */}
                        <div className="flex justify-center mb-4">
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#C89B3C] shadow-[0_0_20px_rgba(200,155,60,0.3)] group-hover:shadow-[0_0_30px_rgba(200,155,60,0.5)] transition-all duration-300">
                              <img 
                                src={user.avatar} 
                                alt={user.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {/* 티어 뱃지 */}
                            <img 
                              src={user.tierIcon} 
                              alt={user.tier}
                              className="absolute -bottom-2 -right-2 w-10 h-10 object-contain"
                            />
                          </div>
                        </div>

                        {/* 유저 정보 */}
                        <div className="text-center">
                          <h3 className="text-xl font-bold tracking-wide mb-1" style={{ color: '#F0E6D2' }}>
                            {user.name}
                          </h3>
                          <p className="text-[#C89B3C] text-sm font-semibold tracking-widest mb-2">
                            {user.tier}
                          </p>
                          <p className="text-[#0AC8B9] text-xs tracking-wider uppercase mb-1">
                            {user.type}
                          </p>
                          <p className="text-[#5B5A56] text-xs">Level {user.level}</p>
                        </div>

                        <p className="text-[#A09B8C] text-sm text-center mt-4">{user.description}</p>

                        <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="flex items-center justify-center gap-2 text-[#C89B3C] text-sm font-medium">
                            <span>VIEW PROFILE</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-gradient-to-r from-[#463714] via-[#C89B3C] to-[#463714] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 환영 모달 */}
          {showWelcomeModal && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
              onClick={() => setShowWelcomeModal(false)}
            >
              <div 
                className="relative bg-gradient-to-b from-[#1E2328] to-[#0A0E13] border-2 border-[#C89B3C] rounded-lg shadow-[0_0_60px_rgba(200,155,60,0.3)] max-w-sm w-full max-h-[90vh] overflow-y-auto animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 상단 장식 라인 */}
                <div className="h-1 bg-gradient-to-r from-[#463714] via-[#C89B3C] to-[#463714]" />
                
                <div className="p-8 text-center">
                  {/* 타이틀 */}
                  <h1 className="text-xl font-bold text-[#C89B3C] tracking-widest uppercase mb-6">OPGG Coaching</h1>
                  
                  {/* 코치 아바타 */}
                  <div className="relative inline-block mb-4">
                    <div className="w-56 h-56 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(200,155,60,0.4)]">
                      <img 
                        src={coachAvatar} 
                        alt="롤의 제왕" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  
                  {/* 코치 정보 */}
                  <h2 className="text-2xl font-bold text-[#C89B3C] mb-1">롤의 제왕</h2>
                  <p className="text-[#F0E6D2]/70 text-sm mb-6">Lv. MAX</p>

                  {/* 메시지 */}
                  <div className="bg-[#010A13]/50 border border-[#463714]/50 rounded-lg p-4 mb-6">
                    <p className="text-[#F0E6D2] text-lg font-medium leading-relaxed">
                      나한테 코칭 받고<br />
                      <span className="text-[#C89B3C]">더 강해져봐!</span> 💪
                    </p>
                  </div>

                  {/* 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowWelcomeModal(false);
                    }}
                    className="w-full py-3 px-6 bg-gradient-to-b from-[#F0E6D2] to-[#C89B3C] hover:from-[#FFFFFF] hover:to-[#F0E6D2] rounded font-semibold text-[#010A13] tracking-wider transition-all"
                  >
                    Start Coaching
                  </button>
                </div>

                {/* 하단 장식 */}
                <div className="h-1 bg-gradient-to-r from-[#463714] via-[#C89B3C] to-[#463714]" />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // 유저 상세 화면
  if (viewMode === "detail" && selectedUser) {
    const advStats = selectedUser.advancedStats;

    return (
      <>
        <Helmet>
          <title>{selectedUser.name} - AI Coach</title>
        </Helmet>
        <div className="min-h-screen bg-[#010A13]">
          {/* 상단 배경 그라데이션 */}
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[#010A13]" />
            <div className="absolute inset-0 opacity-30" style={{
              background: `radial-gradient(ellipse at 50% 0%, #0A323C 0%, transparent 50%)`
            }} />
          </div>

          <div className="container max-w-5xl mx-auto px-4 py-8">
            {/* 뒤로가기 + 도움말 */}
            <div className="flex items-center gap-2 mb-8">
              <button 
                onClick={() => setViewMode("select")}
                className="flex items-center gap-2 text-[#A09B8C] hover:text-[#F0E6D2] transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm tracking-wider uppercase">Back to Selection</span>
              </button>
              <MetricsHelpPopover />
            </div>

            {/* 프로필 헤더 */}
            <div className="relative p-[1px] bg-gradient-to-b from-[#785A28] via-[#463714] to-[#785A28] rounded mb-8 animate-fade-in">
              <div className="bg-gradient-to-b from-[#1E2328] to-[#010A13] rounded p-4 sm:p-6 md:p-8">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 md:gap-8">
                  {/* 프로필 이미지 */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-3 border-[#C89B3C] shadow-[0_0_30px_rgba(200,155,60,0.4)]">
                      <img 
                        src={selectedUser.avatar} 
                        alt={selectedUser.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <img 
                      src={selectedUser.tierIcon} 
                      alt={selectedUser.tier}
                      className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain"
                    />
                  </div>
                  
                  {/* 이름 및 티어 */}
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-[#0AC8B9] text-xs tracking-[0.3em] uppercase mb-1">Summoner</p>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-wide mb-1 sm:mb-2" style={{ color: '#F0E6D2' }}>
                      {selectedUser.name}
                    </h1>
                    <p className="text-[#C89B3C] font-semibold tracking-widest text-sm sm:text-base md:text-lg">
                      {selectedUser.tier}
                    </p>
                    <p className="text-[#5B5A56] text-xs sm:text-sm mt-1">Level {selectedUser.level}</p>
                  </div>
                  
                  {/* 스탯 + 코칭 버튼 */}
                  <div className="flex flex-col gap-3 w-full sm:w-auto">
                    {selectedUser.stats && (
                      <div className="flex sm:grid sm:grid-cols-2 gap-2 sm:gap-4 text-center">
                        <div className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#0A1428] rounded border border-[#463714]/50">
                          <p className="text-lg sm:text-xl md:text-2xl font-bold text-[#F0E6D2]">{selectedUser.stats.winRate}%</p>
                          <p className="text-[#5B5A56] text-[10px] sm:text-xs">WIN RATE</p>
                        </div>
                        <div className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#0A1428] rounded border border-[#463714]/50">
                          <p className="text-base sm:text-lg font-bold text-[#F0E6D2]">{selectedUser.stats.avgKDA}</p>
                          <p className="text-[#5B5A56] text-[10px] sm:text-xs">AVG KDA</p>
                        </div>
                      </div>
                    )}
                    {/* 상단 코칭 시작 버튼 */}
                    <button 
                      onClick={handleStartChat} 
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-b from-[#F0E6D2] to-[#C89B3C] hover:from-[#FFFFFF] hover:to-[#F0E6D2] rounded font-semibold text-[#010A13] hover:text-[#010A13] tracking-wider transition-all text-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Start Coaching</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {advStats && (
              <>
                {/* 레이더 차트 + 스킬 브레이크다운 */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded animate-fade-in">
                    <div className="bg-[#0A0E13] rounded p-6">
                      <h3 className="text-[#C89B3C] text-sm tracking-[0.2em] uppercase mb-4 text-center">
                        Performance Overview
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={advStats.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                            <PolarGrid stroke="#463714" />
                            <PolarAngleAxis dataKey="stat" tick={{ fill: '#A09B8C', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#5B5A56', fontSize: 10 }} axisLine={false} />
                            <Radar name="Stats" dataKey="value" stroke="#C89B3C" fill="#C89B3C" fillOpacity={0.3} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded animate-fade-in" style={{ animationDelay: '50ms' }}>
                    <div className="bg-[#0A0E13] rounded p-6 h-full flex flex-col">
                      <h3 className="text-[#C89B3C] text-sm tracking-[0.2em] uppercase mb-4 text-center">
                        Skill Breakdown
                      </h3>
                      <div className="flex-1 flex flex-col justify-center">
                        {advStats.radarData.map((item, idx) => (
                          <div key={item.stat} className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#A09B8C]">{item.stat}</span>
                              <span className={`font-medium ${item.value >= 70 ? 'text-[#0AC8B9]' : item.value >= 50 ? 'text-[#C89B3C]' : 'text-[#E84057]'}`}>
                                {item.value}/100
                              </span>
                            </div>
                            <div className="h-2 bg-[#1E2328] rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ${
                                  item.value >= 70 ? 'bg-gradient-to-r from-[#0AC8B9] to-[#0397AB]' : 
                                  item.value >= 50 ? 'bg-gradient-to-r from-[#C89B3C] to-[#785A28]' : 
                                  'bg-gradient-to-r from-[#E84057] to-[#9E2A2F]'
                                }`}
                                style={{ width: `${item.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 분석 지표 */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <AnalysisCard title="Early Game (Laning)" icon={Sword} color="bg-gradient-to-r from-[#E84057] to-[#9E2A2F]">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className={`text-xl font-bold ${advStats.earlyGame.csd15 >= 0 ? 'text-[#0AC8B9]' : 'text-[#E84057]'}`}>
                          {advStats.earlyGame.csd15 >= 0 ? '+' : ''}{advStats.earlyGame.csd15}
                        </p>
                        <p className="text-[#5B5A56] text-xs mt-1">CSD@15</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className={`text-xl font-bold ${advStats.earlyGame.gd15 >= 0 ? 'text-[#0AC8B9]' : 'text-[#E84057]'}`}>
                          {advStats.earlyGame.gd15 >= 0 ? '+' : ''}{advStats.earlyGame.gd15}g
                        </p>
                        <p className="text-[#5B5A56] text-xs mt-1">GD@15</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className={`text-lg font-bold ${advStats.earlyGame.xpd15 >= 0 ? 'text-[#0AC8B9]' : 'text-[#E84057]'}`}>
                          {advStats.earlyGame.xpd15 >= 0 ? '+' : ''}{advStats.earlyGame.xpd15}
                        </p>
                        <p className="text-[#5B5A56] text-xs mt-1">XPD@15</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-lg font-bold text-[#F0E6D2]">{advStats.earlyGame.soloKills}</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Solo Kills</p>
                      </div>
                    </div>
                  </AnalysisCard>

                  <AnalysisCard title="Combat & Teamfight" icon={Crosshair} color="bg-gradient-to-r from-[#C89B3C] to-[#785A28]">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-xl font-bold text-[#C89B3C]">{advStats.combat.kp}%</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Kill Participation</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-xl font-bold text-[#F0E6D2]">{advStats.combat.dpm}</p>
                        <p className="text-[#5B5A56] text-xs mt-1">DPM</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className={`text-lg font-bold ${advStats.combat.damageGoldRatio >= 1 ? 'text-[#0AC8B9]' : 'text-[#E84057]'}`}>
                          {advStats.combat.damageGoldRatio.toFixed(2)}
                        </p>
                        <p className="text-[#5B5A56] text-xs mt-1">DMG/Gold</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-lg font-bold text-[#F0E6D2]">{(advStats.combat.damageTakenPerDeath / 1000).toFixed(1)}k</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Taken/Death</p>
                      </div>
                    </div>
                  </AnalysisCard>

                  <AnalysisCard title="Vision & Map Control" icon={Eye} color="bg-gradient-to-r from-[#5383E8] to-[#2C5AA0]">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-xl font-bold text-[#5383E8]">{advStats.vision.visionScore}</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Vision Score</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-xl font-bold text-[#F0E6D2]">{advStats.vision.objectiveControl}%</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Objective Rate</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-lg font-bold text-[#F0E6D2]">{advStats.vision.wpm}</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Wards/Min</p>
                      </div>
                      <div className="bg-[#1E2328] rounded p-3 text-center">
                        <p className="text-lg font-bold text-[#F0E6D2]">{advStats.vision.wcpm}</p>
                        <p className="text-[#5B5A56] text-xs mt-1">Cleared/Min</p>
                      </div>
                    </div>
                  </AnalysisCard>

                  <AnalysisCard title="Resource Efficiency" icon={TrendingUp} color="bg-gradient-to-r from-[#0AC8B9] to-[#0397AB]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#A09B8C]">CS Per Minute</span>
                          <span className={`font-medium ${advStats.resource.cspm >= 8 ? 'text-[#0AC8B9]' : advStats.resource.cspm >= 6 ? 'text-[#C89B3C]' : 'text-[#E84057]'}`}>
                            {advStats.resource.cspm}
                          </span>
                        </div>
                        <div className="h-3 bg-[#1E2328] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#0AC8B9] to-[#0397AB] rounded-full" style={{ width: `${Math.min((advStats.resource.cspm / 10) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#5B5A56] mt-1">
                          <span>0</span><span>Target: 8+</span><span>10</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#A09B8C]">Gold Per Minute</span>
                          <span className="text-[#F0E6D2] font-medium">{advStats.resource.gpm}g</span>
                        </div>
                        <div className="h-3 bg-[#1E2328] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#C89B3C] to-[#785A28] rounded-full" style={{ width: `${Math.min((advStats.resource.gpm / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#5B5A56] mt-1">
                          <span>0</span><span>Target: 400+</span><span>500</span>
                        </div>
                      </div>
                    </div>
                  </AnalysisCard>
                </div>

                {/* 최근 전적 & 모스트 */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded">
                    <div className="bg-[#0A0E13] rounded p-4">
                      <h3 className="text-[#C89B3C] text-xs tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" />Recent Matches
                      </h3>
                      <div className="space-y-2">
                        {selectedUser.recentMatches?.slice(0, 5).map((match, idx) => (
                          <div key={idx} className={`flex items-center justify-between p-2 rounded border ${match.result === "VICTORY" ? "bg-[#28344E]/50 border-[#5383E8]/30" : "bg-[#59343B]/50 border-[#E84057]/30"}`}>
                            <div className="flex items-center gap-2">
                              <img src={match.championIcon} alt={match.champion} className="w-8 h-8 rounded" />
                              <div>
                                <p className="text-[#F0E6D2] text-sm font-medium">{match.champion}</p>
                                <p className={`text-xs font-semibold ${match.result === "VICTORY" ? "text-[#5383E8]" : "text-[#E84057]"}`}>{match.result}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[#F0E6D2] text-sm font-mono">{match.kda}</p>
                              <p className="text-[#5B5A56] text-xs">{match.cs} CS</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded">
                    <div className="bg-[#0A0E13] rounded p-4">
                      <h3 className="text-[#C89B3C] text-xs tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4" />Most Played
                      </h3>
                      <div className="space-y-3">
                        {selectedUser.mostPlayed?.map((champ, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="relative">
                              <img src={champ.championIcon} alt={champ.champion} className="w-12 h-12 rounded-lg border border-[#463714]" />
                              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-[#C89B3C] text-[#010A13]' : idx === 1 ? 'bg-[#8C8C8C] text-[#010A13]' : 'bg-[#8B4513] text-[#F0E6D2]'}`}>
                                {idx + 1}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-[#F0E6D2] font-medium">{champ.champion}</p>
                              <p className="text-[#5B5A56] text-xs">{champ.games} games</p>
                            </div>
                            <div className={`text-sm font-semibold ${champ.winRate >= 50 ? 'text-[#5383E8]' : 'text-[#E84057]'}`}>
                              {champ.winRate}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!advStats && (
              <div className="relative p-[1px] bg-gradient-to-b from-[#463714] to-[#1E2328] rounded mb-8">
                <div className="bg-[#0A0E13] rounded p-12 text-center">
                  <Star className="w-12 h-12 mx-auto text-[#463714] mb-4" />
                  <p className="text-[#A09B8C]">No ranked history yet</p>
                  <p className="text-[#0AC8B9] font-medium mt-2">Begin your journey with AI guidance</p>
                </div>
              </div>
            )}

            {/* 코칭 버튼 */}
            <button onClick={handleStartChat} className="w-full group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#785A28] via-[#C89B3C] to-[#785A28] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-[2px]">
                <div className="bg-gradient-to-r from-[#1E2328] via-[#0A1428] to-[#1E2328] group-hover:from-[#C89B3C]/20 group-hover:via-[#C89B3C]/10 group-hover:to-[#C89B3C]/20 transition-all py-4 px-8 flex items-center justify-center gap-3">
                  <MessageCircle className="w-5 h-5 text-[#C89B3C] group-hover:text-white" />
                  <span className="text-[#C89B3C] group-hover:text-white font-semibold tracking-widest uppercase">Start Coaching</span>
                  <ChevronRight className="w-5 h-5 text-[#C89B3C] group-hover:text-white group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </>
    );
  }

  // 챗봇 전체화면
  if (viewMode === "chat" && selectedUser) {
    return (
      <>
        <Helmet>
          <title>Coaching Session - {selectedUser.name}</title>
        </Helmet>
        <div className="h-screen flex flex-col bg-[#010A13]">
          <div className="fixed inset-0 -z-10 bg-[#010A13]" />
          
          {/* 헤더 */}
          <div className="relative border-b border-[#1E2328] bg-[#0A0E13]/95 backdrop-blur px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 z-10">
            <button onClick={() => setViewMode("detail")} className="text-[#A09B8C] hover:text-[#F0E6D2] transition-colors p-1 sm:p-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-[#C89B3C] flex-shrink-0">
              <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[#F0E6D2] text-sm sm:text-base truncate">{selectedUser.name}</h2>
              <p className="text-[10px] sm:text-xs text-[#C89B3C] tracking-wider truncate">{selectedUser.tier}</p>
            </div>
            
            {/* 게이미피케이션 설명 - 모바일에서 숨김 */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="hidden sm:block p-2 text-[#A09B8C] hover:text-[#C89B3C] transition-colors">
                  <HelpCircle className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#0A0E13] border border-[#463714] text-[#F0E6D2] p-4" align="end">
                <h4 className="font-semibold text-[#C89B3C] mb-3">🎮 레벨 & 미션 시스템</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-[#F0E6D2]">📊 XP & 레벨</p>
                    <p className="text-[#A09B8C] text-xs">미션을 완료하면 XP를 획득하고, 일정 XP를 모으면 레벨업!</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#F0E6D2]">🎯 미션</p>
                    <p className="text-[#A09B8C] text-xs">라인전, 전투, 시야, 자원 4가지 카테고리의 미션을 완료하세요.</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#F0E6D2]">🏅 뱃지</p>
                    <p className="text-[#A09B8C] text-xs">특정 조건을 달성하면 뱃지를 획득할 수 있어요!</p>
                  </div>
                  <div className="pt-2 border-t border-[#463714]/50">
                    <p className="text-[#0AC8B9] text-xs">💡 화면 하단의 "미션 & 진행상황"을 눌러 시작하세요!</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* 사용량 토글 버튼 */}
            <button
              onClick={() => setShowUsagePanel(!showUsagePanel)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded border border-[#C89B3C]/30 bg-[#C89B3C]/10 hover:bg-[#C89B3C]/20 transition-colors flex-shrink-0"
            >
              <DollarSign className="w-3 h-3 text-[#C89B3C]" />
              <span className="text-[10px] sm:text-xs text-[#C89B3C] font-medium">${tokenUsage.cost.toFixed(4)}</span>
              {showUsagePanel ? <ChevronUp className="w-3 h-3 text-[#C89B3C]" /> : <ChevronDown className="w-3 h-3 text-[#C89B3C]" />}
            </button>
            
            {/* 음성 상태 표시 (TTS가 켜져있을 때만) */}
            {ttsEnabled && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded border flex-shrink-0 ${
                isSpeaking 
                  ? 'border-[#0AC8B9]/50 bg-[#0AC8B9]/20' 
                  : 'border-[#463714]/50 bg-[#1E2328]/50'
              }`}>
                <Volume2 className={`w-4 h-4 text-[#0AC8B9] ${isSpeaking ? 'animate-pulse' : ''}`} />
              </div>
            )}
            
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded border border-[#0AC8B9]/30 bg-[#0AC8B9]/10 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#0AC8B9] animate-pulse" />
              <span className="text-[10px] sm:text-xs text-[#0AC8B9] font-medium tracking-wider">LIVE</span>
            </div>
          </div>
          
          {/* 사용량 패널 */}
          {showUsagePanel && (
            <div className="absolute top-16 right-4 z-30 animate-fade-in">
              <div className="bg-[#0A0E13]/95 backdrop-blur border border-[#463714] rounded-lg p-4 shadow-xl min-w-[280px]">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-[#C89B3C]" />
                  <h4 className="text-[#C89B3C] font-semibold text-sm">Token Usage</h4>
                </div>
                
                <div className="space-y-3">
                  {/* 토큰 사용량 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#1E2328] rounded p-2 text-center">
                      <p className="text-[#5B5A56] text-[10px] uppercase tracking-wider">Input</p>
                      <p className="text-[#F0E6D2] font-mono text-sm">{tokenUsage.prompt_tokens.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#1E2328] rounded p-2 text-center">
                      <p className="text-[#5B5A56] text-[10px] uppercase tracking-wider">Output</p>
                      <p className="text-[#F0E6D2] font-mono text-sm">{tokenUsage.completion_tokens.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* 캐시된 토큰 정보 */}
                  <div className="bg-[#0AC8B9]/10 border border-[#0AC8B9]/30 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#0AC8B9] text-xs font-medium">🚀 캐시된 토큰</span>
                      <span className="text-[#0AC8B9] font-mono font-bold">{tokenUsage.cached_tokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#5B5A56]">캐시 비율</span>
                      <span className={`font-medium ${tokenUsage.prompt_tokens > 0 && (tokenUsage.cached_tokens / tokenUsage.prompt_tokens) > 0.3 ? 'text-[#0AC8B9]' : 'text-[#A09B8C]'}`}>
                        {tokenUsage.prompt_tokens > 0 ? ((tokenUsage.cached_tokens / tokenUsage.prompt_tokens) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] mt-1">
                      <span className="text-[#5B5A56]">절감액</span>
                      <span className="text-[#0AC8B9]">
                        ${(tokenUsage.cached_tokens * GPT4O_MINI_PRICING.input * 0.5).toFixed(6)}
                      </span>
                    </div>
                  </div>
                  
                  {/* GPT 비용 */}
                  <div className="bg-gradient-to-r from-[#C89B3C]/20 to-[#785A28]/20 border border-[#C89B3C]/30 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#A09B8C] text-xs">🤖 GPT 비용</span>
                      <span className="text-[#C89B3C] font-bold">${tokenUsage.cost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#5B5A56]">일반: $0.15/1M</span>
                      <span className="text-[#5B5A56]">캐시: $0.075/1M</span>
                    </div>
                  </div>
                  
                  {/* TTS 비용 */}
                  <div className="bg-gradient-to-r from-[#9B59B6]/20 to-[#8E44AD]/20 border border-[#9B59B6]/30 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#A09B8C] text-xs">🔊 TTS 비용</span>
                      <span className="text-[#9B59B6] font-bold">${tokenUsage.tts_cost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#5B5A56]">문자 수</span>
                      <span className="text-[#9B59B6]">{tokenUsage.tts_chars.toLocaleString()}자</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] mt-1">
                      <span className="text-[#5B5A56]">단가</span>
                      <span className="text-[#5B5A56]">$0.22/1K자</span>
                    </div>
                  </div>
                  
                  {/* 총 비용 */}
                  <div className="bg-gradient-to-r from-[#E74C3C]/20 to-[#C0392B]/20 border border-[#E74C3C]/30 rounded p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[#F0E6D2] text-xs font-medium">💰 총 비용</span>
                      <span className="text-[#E74C3C] font-bold">${(tokenUsage.cost + tokenUsage.tts_cost).toFixed(6)}</span>
                    </div>
                  </div>
                  
                  {/* 예상 비용 */}
                  <div className="border-t border-[#463714]/50 pt-3">
                    <p className="text-[#5B5A56] text-[10px] uppercase tracking-wider mb-2">예상 월간 비용 (1,000명 기준)</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#A09B8C]">GPT (일 10회)</span>
                        <span className="text-[#C89B3C]">${((tokenUsage.cost / Math.max(messages.filter(m => m.role === 'user').length, 1)) * 10 * 1000 * 30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A09B8C]">TTS (일 10회)</span>
                        <span className="text-[#9B59B6]">${((tokenUsage.tts_cost / Math.max(messages.filter(m => m.role === 'user').length, 1)) * 10 * 1000 * 30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#463714]/30 pt-1 mt-1">
                        <span className="text-[#F0E6D2] font-medium">합계 (일 10회)</span>
                        <span className="text-[#E74C3C] font-bold">${(((tokenUsage.cost + tokenUsage.tts_cost) / Math.max(messages.filter(m => m.role === 'user').length, 1)) * 10 * 1000 * 30).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 메시지 */}
          <ScrollArea className="flex-1 relative z-10">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in gap-3`}>
                  {msg.role === "assistant" && (
                    <button 
                      onClick={() => setProfileCardTarget({ isCoach: true })}
                      className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#C89B3C] transition-all ${msg.type === "celebration" ? "ring-2 ring-[#C89B3C] ring-offset-2 ring-offset-[#010A13]" : ""}`}
                    >
                      <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" />
                    </button>
                  )}
                  
                  {/* 일반 메시지 */}
                  {msg.type !== "celebration" && (
                    <div className={`max-w-[75%] ${msg.role === "user" ? "" : "flex flex-col"}`}>
                      <div className={`rounded px-4 py-3 ${msg.role === "user" ? "bg-[#0AC8B9]/20 border border-[#0AC8B9]/30 text-[#F0E6D2]" : "bg-[#1E2328]/60 backdrop-blur-sm border border-[#463714]/30 text-[#A09B8C]"}`}>
                        <div 
                          className="whitespace-pre-wrap text-sm leading-relaxed [&_strong]:font-bold [&_strong]:text-[#C89B3C]"
                          dangerouslySetInnerHTML={{ 
                            __html: msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          }} 
                        />
                      </div>
                      {/* 봇 메시지에만 피드백 버튼 + 음성 정지 버튼 */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => handleFeedback(idx, "up")}
                              className={`p-1.5 rounded transition-all ${msg.feedback === "up" ? "text-[#0AC8B9] bg-[#0AC8B9]/20" : "text-[#5B5A56] hover:text-[#A09B8C] hover:bg-[#1E2328]"}`}
                              title="좋아요"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFeedback(idx, "down")}
                              className={`p-1.5 rounded transition-all ${msg.feedback === "down" ? "text-[#E84057] bg-[#E84057]/20" : "text-[#5B5A56] hover:text-[#A09B8C] hover:bg-[#1E2328]"}`}
                              title="별로예요"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* 음성 재생 중일 때만 정지 버튼 표시 */}
                          {isSpeaking && typingMessageIndex === idx && (
                            <button
                              onClick={stopTTS}
                              className="p-1.5 rounded transition-all text-[#E84057] hover:bg-[#E84057]/20 mr-1"
                              title="Stop voice"
                              aria-label="Stop voice"
                            >
                              <VolumeX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 특수 축하 메시지 */}
                  {msg.type === "celebration" && (
                    <div className="max-w-[80%] relative overflow-hidden rounded-lg animate-scale-in">
                      {/* 배경 그라데이션 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#C89B3C]/30 via-[#785A28]/20 to-[#0AC8B9]/20" />
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjEiIGZpbGw9IiNDODlCM0MiIG9wYWNpdHk9IjAuMyIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNzdGFycykiLz48L3N2Zz4=')] opacity-50" />
                      
                      {/* 테두리 효과 */}
                      <div className="absolute inset-0 rounded-lg border-2 border-[#C89B3C]/50 shadow-[0_0_20px_rgba(200,155,60,0.3)]" />
                      
                      {/* 콘텐츠 */}
                      <div className="relative p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🎉</span>
                          <span className="text-[#C89B3C] font-bold text-sm tracking-wider">MISSION COMPLETE</span>
                        </div>
                        <div 
                          className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0E6D2] [&_strong]:font-bold [&_strong]:text-[#C89B3C]"
                          dangerouslySetInnerHTML={{ 
                            __html: msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          }} 
                        />
                      </div>
                      
                      {/* 빛나는 효과 */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C89B3C]/60 to-transparent animate-pulse" />
                    </div>
                  )}
                  
                  {msg.role === "user" && selectedUser && (
                    <button 
                      onClick={() => setProfileCardTarget({ isCoach: false })}
                      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-[#0AC8B9]/50 cursor-pointer hover:ring-2 hover:ring-[#0AC8B9] transition-all"
                    >
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                    </button>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-in gap-3">
                  <button 
                    onClick={() => setProfileCardTarget({ isCoach: true })}
                    className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#C89B3C] transition-all"
                  >
                    <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" />
                  </button>
                  <div className="bg-[#1E2328] border border-[#463714]/50 rounded px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-[#C89B3C] rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-[#C89B3C] rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-2 h-2 bg-[#C89B3C] rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* 미션 패널 */}
          <LolMissionPanel 
            onMissionComplete={(message) => {
              setMessages(prev => [...prev, { role: "assistant", content: message, type: "celebration" }]);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }}
          />

          {/* 입력 */}
          <div className="relative border-t border-[#1E2328] bg-[#0A0E13]/95 backdrop-blur p-4 z-10">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    onKeyPress={handleKeyPress}
                    placeholder="무엇이든 물어보세요..."
                    disabled={isLoading}
                    maxLength={MAX_MESSAGE_LENGTH}
                    className={`w-full h-12 bg-[#1E2328] border rounded px-4 pr-16 text-[#F0E6D2] placeholder:text-[#5B5A56] focus:outline-none focus:ring-1 ${
                      inputMessage.length >= MAX_MESSAGE_LENGTH 
                        ? 'border-[#E84057] focus:border-[#E84057] focus:ring-[#E84057]/20' 
                        : 'border-[#463714]/50 focus:border-[#C89B3C]/50 focus:ring-[#C89B3C]/20'
                    }`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                    inputMessage.length >= MAX_MESSAGE_LENGTH ? 'text-[#E84057]' 
                    : inputMessage.length >= MAX_MESSAGE_LENGTH * 0.8 ? 'text-[#C89B3C]' 
                    : 'text-[#5B5A56]'
                  }`}>
                    {inputMessage.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <button 
                  onClick={sendMessage} 
                  disabled={isLoading || !inputMessage.trim()}
                  className="h-12 px-6 bg-gradient-to-b from-[#C89B3C] to-[#785A28] hover:from-[#F0E6D2] hover:to-[#C89B3C] disabled:opacity-50 disabled:cursor-not-allowed rounded font-semibold text-[#010A13]"
                >
                  보내기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 프로필 카드 모달 */}
        {profileCardTarget && (
          <LolProfileCard
            user={selectedUser ? {
              id: selectedUser.id,
              name: selectedUser.name,
              avatar: selectedUser.avatar,
              tier: selectedUser.tier,
              tierIcon: selectedUser.tierIcon,
              level: selectedUser.level,
              type: selectedUser.type,
              description: selectedUser.description,
              advancedStats: selectedUser.advancedStats,
            } : null}
            isCoach={profileCardTarget.isCoach}
            onClose={() => setProfileCardTarget(null)}
            ttsEnabled={ttsEnabled}
            onTtsToggle={async (enabled) => {
              if (enabled) unlockTTS();
              else stopTTS();
              setTtsEnabled(enabled);
              
              // 설정 저장
              if (currentUserId) {
                // 로그인 사용자: DB에 저장
                await supabase
                  .from('profiles')
                  .update({ lol_tts_enabled: enabled })
                  .eq('id', currentUserId);
              } else {
                // 비로그인 사용자: localStorage에 저장
                localStorage.setItem('lol_tts_enabled', String(enabled));
              }
            }}
            isSpeaking={isSpeaking}
          />
        )}
      </>
    );
  }

  return null;
};

export default LolCoach;
