import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sdk } from "@farcaster/miniapp-sdk";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, CheckCircle, AlertCircle, Sparkles, Home, Gift, Clock, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// SDK context 타입 정의
interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  verifiedAddresses?: {
    ethAddresses?: string[];
  };
}

interface FarcasterContext {
  user?: FarcasterUser;
}

interface Challenge {
  id: string;
  question: string;
  options: any;
  total_prize_usdc: number;
  end_time: string;
  start_time: string;
  image_url: string | null;
  status: string;
  correct_answer: string;
  admin_approved_at: string | null;
  winner_count: number;
}

interface Winner {
  id: string;
  external_wallet_id: string;
  answer: string;
  prize_amount: number | null;
  claimed_at: string | null;
  // 외부 지갑의 공개 프로필(지갑주소/ fid 제외)
  external_wallet_profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    source: string;
  } | null;
}

interface MyParticipation {
  id: string;
  answer: string;
  is_winner: boolean | null;
  prize_amount: number | null;
  claimed_at: string | null;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

// 날짜 포맷 함수 (영문)
const formatEndTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function FarcasterApp() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewMode = searchParams.get('preview'); // 'success' | 'error' | null
  
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FarcasterContext | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>(previewMode === 'success' ? 'success' : previewMode === 'error' ? 'error' : 'idle');
  const [submitMessage, setSubmitMessage] = useState(previewMode === 'success' ? "Your answer has been recorded. Good luck!" : previewMode === 'error' ? "Preview error state" : "");

  // 결과 페이지용 상태
  const [isEnded, setIsEnded] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [myParticipation, setMyParticipation] = useState<MyParticipation | null>(null);
  const [claiming, setClaiming] = useState(false);

  // SDK 초기화 - 재시도 로직으로 안정성 향상
  useEffect(() => {
    let cancelled = false;
    
    const initSDK = async () => {
      // 최대 3번 시도, 각각 2초 타임아웃
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SDK timeout')), 2000)
          );
          
          const contextPromise = sdk.context;
          const ctx = await Promise.race([contextPromise, timeoutPromise]);
          setContext(ctx as FarcasterContext);
          
          // ready 호출도 재시도
          try {
            await sdk.actions.ready();
          } catch {
            // ready 실패해도 진행
          }
          
          setIsSDKLoaded(true);
          console.log("[FarcasterApp] SDK initialized successfully");
          return;
        } catch (err) {
          console.warn(`[FarcasterApp] SDK init attempt ${attempt + 1} failed:`, err);
          // 마지막 시도가 아니면 대기
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      // 모든 시도 실패 - 브라우저 환경으로 간주
      console.log("[FarcasterApp] Running in browser preview mode");
      setIsSDKLoaded(true);
    };
    
    initSDK();
    
    return () => { cancelled = true; };
  }, []);

  // 챌린지 데이터 로드
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!challengeId) {
        setError("Challenge ID not provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("challenges")
          .select("id, question, options, total_prize_usdc, end_time, start_time, image_url, status, correct_answer, admin_approved_at, winner_count")
          .eq("id", challengeId)
          .single();

        if (fetchError || !data) {
          setError("Challenge not found");
        } else {
          setChallenge(data);
          
          // 챌린지가 종료되었는지 확인
          const now = new Date();
          const endTime = new Date(data.end_time);
          if (endTime < now || data.status === 'completed') {
            setIsEnded(true);
          }
        }
      } catch (err) {
        setError("Failed to load challenge");
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeId]);

  // 종료된 챌린지: 당첨자 목록 로드 (fid 없어도 실행)
  useEffect(() => {
    if (!isEnded || !challengeId || !challenge?.admin_approved_at) return;

    const fetchWinners = async () => {
      try {
        // external_wallet_users 테이블은 권한 제한이 있어(403) 직접 조인하지 않고
        // 1) winners rows만 가져온 뒤 2) public projection 테이블에서 프로필을 별도 조회
        const { data: winnersRows, error: winnersError } = await supabase
          .from("external_challenge_participations")
          .select("id, external_wallet_id, answer, prize_amount, claimed_at")
          .eq("challenge_id", challengeId)
          .eq("is_winner", true)
          .order("prize_amount", { ascending: false })
          .limit(10);

        if (winnersError) throw winnersError;
        if (!winnersRows || winnersRows.length === 0) {
          setWinners([]);
          return;
        }

        const walletIds = Array.from(
          new Set((winnersRows as any[]).map((r) => r.external_wallet_id).filter(Boolean))
        );

        const { data: profiles, error: profilesError } = await supabase
          .from("external_wallet_profiles_public")
          .select("id, username, display_name, avatar_url, source")
          .in("id", walletIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map<string, any>();
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

        const merged: Winner[] = (winnersRows as any[]).map((row) => ({
          id: row.id,
          external_wallet_id: row.external_wallet_id,
          answer: row.answer,
          prize_amount: row.prize_amount,
          claimed_at: row.claimed_at,
          external_wallet_profile: profileMap.get(row.external_wallet_id) || null,
        }));

        setWinners(merged);
      } catch (err) {
        console.error("[FarcasterApp] Failed to fetch winners:", err);
      }
    };

    fetchWinners();
  }, [isEnded, challengeId, challenge?.admin_approved_at]);

  // 종료된 챌린지: 내 참여 정보 로드 (fid 필요)
  useEffect(() => {
    if (!isEnded || !challengeId || !context?.user?.fid) return;

    const fetchMyParticipation = async () => {
      try {
        // external_wallet_users 권한 제한 때문에(403) Edge Function으로 내 참여를 조회
        const walletAddress = context.user?.verifiedAddresses?.ethAddresses?.[0] || null;

        const { data, error } = await supabase.functions.invoke(
          "farcaster-get-my-participation",
          {
            body: {
              challengeId,
              fid: context.user!.fid,
              walletAddress,
            },
          }
        );

        if (error) throw error;
        if (data?.participation) {
          setMyParticipation(data.participation as MyParticipation);
        } else {
          setMyParticipation(null);
        }
      } catch (err) {
        console.error("[FarcasterApp] Failed to fetch my participation:", err);
      }
    };

    fetchMyParticipation();
  }, [isEnded, challengeId, context?.user?.fid]);

  // 옵션 텍스트 추출
  const getOptionTexts = useCallback((): string[] => {
    if (!challenge?.options) return [];
    
    const raw = challenge.options;
    
    if (Array.isArray(raw)) {
      return raw.map((v: any) => String(v)).filter(Boolean);
    }
    
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((v: any) => String(v)).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    
    if (typeof raw === "object") {
      const maybeItems = (raw as any).items;
      if (Array.isArray(maybeItems)) {
        return maybeItems
          .map((item: any) => item?.text ?? item?.label ?? "")
          .map((v: any) => String(v))
          .filter(Boolean);
      }
      
      const maybeOptions = (raw as any).options;
      if (Array.isArray(maybeOptions)) {
        return maybeOptions.map((v: any) => String(v)).filter(Boolean);
      }
    }
    
    return [];
  }, [challenge?.options]);

  const options = getOptionTexts();
  const isMultipleChoice = options.length > 0;

  // 클레임 처리
  const handleClaim = async () => {
    if (!myParticipation) {
      toast.error("No participation found");
      return;
    }

    setClaiming(true);
    try {
      // verifiedAddresses가 없으면 SDK를 통해 지갑 연결 요청
      let walletAddress = context?.user?.verifiedAddresses?.ethAddresses?.[0];
      
      if (!walletAddress) {
        // SDK wallet provider를 통해 주소 요청
        const accounts = await sdk.wallet.ethProvider.request({
          method: 'eth_requestAccounts',
          params: [],
        }) as string[];
        
        if (!accounts || accounts.length === 0) {
          toast.error("Please connect your wallet to claim");
          setClaiming(false);
          return;
        }
        walletAddress = accounts[0];
      }

      const message = `Claim prize for challenge ${challengeId}\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;

      // 서명 요청
      const signature = await sdk.wallet.ethProvider.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });

      // Edge Function 호출
      const { data, error: claimError } = await supabase.functions.invoke('claim-external-prize', {
        body: {
          participationId: myParticipation.id,
          walletAddress,
          message,
          signature,
        },
      });

      if (claimError || data?.error) {
        throw new Error(data?.message || claimError?.message || 'Claim failed');
      }

      // 성공 시 UI 업데이트
      setMyParticipation(prev => prev ? { ...prev, claimed_at: new Date().toISOString() } : null);
      toast.success(`Successfully claimed $${myParticipation.prize_amount} USDC!`);
    } catch (err: any) {
      console.error("[FarcasterApp] Claim error:", err);
      toast.error(err.message || "Failed to claim prize");
    } finally {
      setClaiming(false);
    }
  };

  // 답변 제출
  const handleSubmit = async () => {
    if (!context?.user?.fid || !challengeId) {
      setSubmitState("error");
      setSubmitMessage("Farcaster connection required");
      return;
    }

    const answer = isMultipleChoice 
      ? (selectedOption !== null ? options[selectedOption] : null)
      : textAnswer.trim();

    if (!answer) {
      setSubmitState("error");
      setSubmitMessage("Please provide an answer");
      return;
    }

    setSubmitState("submitting");

    try {
      const { data, error: submitError } = await supabase.functions.invoke(
        "farcaster-participate",
        {
          body: {
            challengeId,
            answer,
            fid: context.user.fid,
            username: context.user.username,
            displayName: context.user.displayName,
            walletAddress: context.user.verifiedAddresses?.ethAddresses?.[0] || null,
          },
        }
      );

      if (submitError) {
        console.error('[FarcasterApp] Submit error:', submitError);

        let detailedMessage = submitError.message || 'Failed to connect to server';

        try {
          const ctx: any = (submitError as any).context;

          const res: Response | undefined =
            (typeof Response !== 'undefined' && ctx instanceof Response)
              ? ctx
              : (typeof Response !== 'undefined' && ctx?.response instanceof Response)
                ? ctx.response
                : undefined;

          if (res) {
            const bodyText = await res.clone().text().catch(() => '');
            if (bodyText) {
              try {
                const parsed = JSON.parse(bodyText);
                detailedMessage = parsed?.message || parsed?.error || detailedMessage;
              } catch {
                detailedMessage = bodyText;
              }
            }
          } else if (typeof ctx?.body === 'string') {
            try {
              const parsed = JSON.parse(ctx.body);
              detailedMessage = parsed?.message || parsed?.error || detailedMessage;
            } catch {
              detailedMessage = ctx.body || detailedMessage;
            }
          } else if (ctx?.body && typeof ctx.body === 'object') {
            detailedMessage = ctx.body?.message || ctx.body?.error || detailedMessage;
          }
        } catch (parseErr) {
          console.warn('[FarcasterApp] Failed to parse edge function error body:', parseErr);
        }

        throw new Error(detailedMessage);
      }

      if (data?.error) {
        console.error('[FarcasterApp] Server error:', data);
        throw new Error(data.message || data.error || 'Server error');
      }

      setSubmitState("success");
      setSubmitMessage(data?.message || "Entry submitted successfully!");
    } catch (err: any) {
      console.error('[FarcasterApp] Caught error:', err);
      setSubmitState("error");
      setSubmitMessage(err.message || "Failed to submit answer");
    }
  };

  const handleClose = () => {
    sdk.actions.close();
  };

  const openKTrendz = () => {
    sdk.actions.openUrl(`https://k-trendz.com/challenges/${challengeId}`);
  };

  // 프리뷰 모드가 아닐 때만 로딩 상태 표시
  if (!previewMode && (loading || !isSDKLoaded)) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white/80 font-medium">Loading challenge...</p>
        </div>
      </div>
    );
  }

  // 프리뷰 모드가 아닐 때만 에러 상태 표시
  if (!previewMode && error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Oops!</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <Button onClick={handleClose} variant="outline" className="w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20">
            Close
          </Button>
        </div>
      </div>
    );
  }

  // 종료된 챌린지 - 결과 화면
  if (isEnded && challenge) {
    const isApproved = !!challenge.admin_approved_at;
    const isWinner = myParticipation?.is_winner === true;
    const canClaim = isWinner && myParticipation?.prize_amount && !myParticipation?.claimed_at;
    const hasClaimed = isWinner && !!myParticipation?.claimed_at;

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
        {/* 상단 홈 버튼 */}
        <div className="pt-4 px-4">
          <button
            onClick={() => navigate('/miniapp')}
            className="p-2 hover:opacity-70 transition-opacity"
            aria-label="Go to Home"
          >
            <Home className="h-6 w-6 text-white/50" />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* 헤더 */}
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl px-4 py-2">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <span className="text-white font-bold">Challenge Results</span>
            </div>
          </div>

          {/* 챌린지 이미지 */}
          {challenge.image_url && (
            <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-white/30">
              <img 
                src={challenge.image_url} 
                alt="Challenge" 
                className="w-full h-40 object-cover"
              />
            </div>
          )}

          {/* 질문 */}
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
            <p className="text-white font-medium text-center">{challenge.question}</p>
          </div>

          {/* 결과 대기 중 */}
          {!isApproved && (
            <div className="bg-amber-500/30 backdrop-blur-xl border border-amber-400/50 rounded-2xl p-5 text-center">
              <Clock className="h-10 w-10 text-amber-300 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-2">Results Pending</h3>
              <p className="text-white/80 text-sm">
                Winners will be announced soon. Check back later!
              </p>
              {myParticipation && (
                <div className="mt-4 bg-white/10 rounded-xl p-3">
                  <p className="text-white/70 text-xs">Your answer</p>
                  <p className="text-white font-medium">{myParticipation.answer}</p>
                </div>
              )}
            </div>
          )}

          {/* 결과 발표됨 */}
          {isApproved && (
            <>
              {/* 정답 표시 */}
              <div className="bg-green-500/30 backdrop-blur-xl border border-green-400/50 rounded-2xl p-4 text-center">
                <p className="text-green-200 text-xs uppercase tracking-wider mb-1">Correct Answer</p>
                <p className="text-white font-bold text-xl">{challenge.correct_answer}</p>
              </div>

              {/* 내 결과 - 당첨 */}
              {isWinner && myParticipation && (
                <div className="bg-gradient-to-br from-yellow-400/40 to-orange-500/40 backdrop-blur-xl border-2 border-yellow-400/60 rounded-2xl p-5 text-center">
                  <div className="w-16 h-16 bg-yellow-400/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Award className="h-8 w-8 text-yellow-300" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">🎉 Congratulations!</h3>
                  <p className="text-white/90 mb-3">You won <span className="font-bold text-yellow-300">${myParticipation.prize_amount} USDC</span>!</p>
                  
                  {canClaim && (
                    <Button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="w-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-lg hover:opacity-90"
                    >
                      {claiming ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Gift className="h-4 w-4 mr-2" />
                          Claim Prize
                        </>
                      )}
                    </Button>
                  )}

                  {hasClaimed && (
                    <div className="bg-green-500/30 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-300" />
                      <span className="text-green-200 text-sm font-medium">Prize Claimed!</span>
                    </div>
                  )}
                </div>
              )}

              {/* 내 결과 - 미당첨 */}
              {myParticipation && !isWinner && (
                <div className="bg-white/15 backdrop-blur-xl border border-white/30 rounded-2xl p-4 text-center">
                  <p className="text-white/70 text-sm mb-1">Your answer: <span className="text-white font-medium">{myParticipation.answer}</span></p>
                  <p className="text-white/80">Better luck next time! 💪</p>
                </div>
              )}

              {/* 당첨자 리스트 */}
              {winners.length > 0 && (
                <div className="bg-white/15 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-300" />
                    Winners ({winners.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {winners.map((winner, idx) => (
                      <div 
                        key={winner.id}
                        className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        {winner.external_wallet_profile?.avatar_url ? (
                          <img 
                            src={winner.external_wallet_profile.avatar_url} 
                            alt="" 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-white text-xs">👤</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">
                            {winner.external_wallet_profile?.display_name || 
                             winner.external_wallet_profile?.username || 
                             `Winner #${idx + 1}`}
                          </p>
                        </div>
                        <div className="text-green-300 font-bold text-sm">
                          ${winner.prize_amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 더 많은 챌린지 보기 */}
          <div className="pt-2 space-y-3">
            <Button 
              onClick={() => navigate('/miniapp')}
              variant="outline" 
              className="w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              Browse More Quizzes
            </Button>
            <Button 
              onClick={openKTrendz}
              className="w-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 font-bold shadow-lg"
            >
              View on K-Trendz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 제출 성공 상태
  if (submitState === "success") {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex flex-col p-4">
        {/* 상단 홈 버튼 */}
        <div className="flex justify-start mb-4">
          <button
            onClick={() => navigate('/miniapp')}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-lg border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Go to Home"
          >
            <Home className="h-5 w-5 text-white" />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-green-400/30 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">🎉 You're In!</h2>
            <p className="text-white/80 mb-6">{submitMessage}</p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/miniapp')} variant="outline" className="w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20">
                Browse More Quizzes
              </Button>
              <Button onClick={openKTrendz} className="w-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 font-bold shadow-lg">
                View on K-Trendz
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 제출 에러 상태 - 결과 화면으로 표시 (이미 참여함 등)
  if (submitState === "error") {
    const isAlreadyParticipated = submitMessage?.toLowerCase().includes('already');
    
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex flex-col p-4">
        {/* 상단 홈 버튼 */}
        <div className="flex justify-start mb-4">
          <button
            onClick={() => navigate('/miniapp')}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-lg border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Go to Home"
          >
            <Home className="h-5 w-5 text-white" />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className={`w-20 h-20 ${isAlreadyParticipated ? 'bg-amber-400/30' : 'bg-red-400/30'} backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isAlreadyParticipated ? (
                <CheckCircle className="h-10 w-10 text-amber-300" />
              ) : (
                <AlertCircle className="h-10 w-10 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isAlreadyParticipated ? '✅ Already Entered!' : 'Oops!'}
            </h2>
            <p className="text-white/80 mb-6">{submitMessage}</p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/miniapp')} variant="outline" className="w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20">
                Browse More Quizzes
              </Button>
              <Button onClick={openKTrendz} className="w-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 font-bold shadow-lg">
                View on K-Trendz
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 메인 챌린지 UI - 인스타 스타일 글래스모피즘
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
      {/* 상단 홈 버튼 행 */}
      <div className="pt-4 px-4">
        <button
          onClick={() => navigate('/miniapp')}
          className="p-2 hover:opacity-70 transition-opacity"
          aria-label="Go to Home"
        >
          <Home className="h-6 w-6 text-white/50" />
        </button>
      </div>
      
      {/* 헤더 - 타이틀 */}
      <div className="py-2 px-4">
        <div className="w-full flex items-center justify-center gap-2 bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl px-4 py-3">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          <span className="text-white font-medium text-sm">K-Trendz Challenge</span>
          <Sparkles className="h-4 w-4 text-yellow-300" />
        </div>
        {context?.user && (
          <p className="text-white/70 text-xs mt-2 text-center">
            Playing as @{context.user.username}
          </p>
        )}
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* 챌린지 이미지 */}
        {challenge?.image_url && (
          <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-white/30 backdrop-blur">
            <img 
              src={challenge.image_url} 
              alt="Challenge" 
              className="w-full h-44 object-cover"
            />
          </div>
        )}

        {/* 상금 배지 - 반짝이는 효과 */}
        <div className="flex justify-center">
          <div className="relative">
            {/* 반짝이는 배경 효과 */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-300 via-white to-yellow-300 rounded-full opacity-30 animate-[pulse_1.5s_ease-in-out_infinite]" />
            
            {/* 메인 배지 */}
            <div className="relative bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 text-white rounded-full px-6 py-3 shadow-2xl flex items-center gap-2 font-bold border-2 border-white/50">
              <Trophy className="h-5 w-5 text-white drop-shadow" />
              <span className="drop-shadow-lg">${challenge?.total_prize_usdc || 0} USDC Prize Pool!</span>
            </div>
          </div>
        </div>

        {/* 질문 카드 - 글래스모피즘 */}
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-5 shadow-2xl">
          <div className="flex justify-center mb-3">
            <div className="bg-purple-500/40 rounded-full px-3 py-1">
              <span className="text-white text-xs font-medium">🎯 Quiz Question</span>
            </div>
          </div>
          <p className="text-white text-base font-medium text-center leading-relaxed">
            {challenge?.question}
          </p>
        </div>

        {/* 답변 선택 영역 */}
        {isMultipleChoice ? (
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all duration-200 ${
                  selectedOption === idx
                    ? "bg-white/30 border-white text-white shadow-lg scale-[1.02]"
                    : "bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === idx 
                      ? "border-white bg-white" 
                      : "border-white/50"
                  }`}>
                    {selectedOption === idx && (
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <span className="font-medium">{opt}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur border border-white/30 rounded-2xl p-4">
            <Input
              type="text"
              placeholder="Type your answer..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/50 rounded-xl focus:border-white focus:ring-white"
            />
          </div>
        )}

        {/* 제출 버튼 */}
        <Button
          onClick={handleSubmit}
          disabled={submitState === "submitting" || (isMultipleChoice ? selectedOption === null : !textAnswer.trim())}
          className="w-full rounded-full py-6 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-bold text-lg shadow-2xl hover:opacity-90 disabled:opacity-50 border-2 border-white/30"
        >
          {submitState === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Submit Answer
            </>
          )}
        </Button>

        {/* 종료 시간 */}
        <p className="text-center text-white/60 text-xs">
          Ends: {challenge?.end_time ? formatEndTime(challenge.end_time) : 'N/A'}
        </p>
      </div>
    </div>
  );
}
