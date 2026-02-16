import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "@farcaster/miniapp-sdk";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, X, Clock, ChevronRight, Wand2, ShoppingBag, ExternalLink, Gift, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";
import { useToast } from "@/hooks/use-toast";

const FANZTOKEN_V5_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7";
const FANZTOKEN_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[])"
];

interface Challenge {
  id: string;
  question: string;
  total_prize_usdc: number;
  end_time: string;
  image_url?: string | null;
  wiki_entry?: {
    title?: string;
    image_url?: string;
  } | null;
}

interface UnclaimedPrize {
  id: string;
  challenge_id: string;
  prize_amount: number;
  challenge_question: string;
}

export default function MiniAppHome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasLightstick, setHasLightstick] = useState(false);
  const [isCheckingLightstick, setIsCheckingLightstick] = useState(true);
  const [userAddresses, setUserAddresses] = useState<string[]>([]);
  const [unclaimedPrizes, setUnclaimedPrizes] = useState<UnclaimedPrize[]>([]);
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // SDK ready 호출 및 사용자 지갑 주소 가져오기
  useEffect(() => {
    let cancelled = false;
    
    const initSDK = async () => {
      // SDK ready 호출
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          await sdk.actions.ready();
          console.log("[MiniAppHome] SDK ready successful");
          break;
        } catch (err) {
          console.warn(`[MiniAppHome] SDK ready attempt ${attempt + 1} failed`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // 사용자 지갑 주소 가져오기 (ethProvider 사용)
      try {
        const provider = sdk.wallet.ethProvider;
        if (provider) {
          const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            console.log("[MiniAppHome] User eth addresses:", accounts);
            setUserAddresses(accounts);
          } else {
            setIsCheckingLightstick(false);
          }
        } else {
          setIsCheckingLightstick(false);
        }
      } catch (err) {
        console.warn("[MiniAppHome] Failed to get wallet addresses:", err);
        setIsCheckingLightstick(false);
      }
    };
    
    void initSDK();
    
    return () => { cancelled = true; };
  }, []);

  // 온체인에서 응원봉 보유 여부 체크
  useEffect(() => {
    if (userAddresses.length === 0) return;

    const checkLightstickOwnership = async () => {
      try {
        // 활성 토큰 목록 가져오기
        const { data: tokenRows } = await supabase
          .from('fanz_tokens')
          .select('token_id')
          .eq('contract_address', FANZTOKEN_V5_ADDRESS);

        if (!tokenRows || tokenRows.length === 0) {
          setIsCheckingLightstick(false);
          return;
        }

        const tokenIds = tokenRows.map((t) => BigInt(t.token_id));
        // staticNetwork 옵션으로 네트워크 감지 스킵 (무한 재시도 방지)
        const provider = new ethers.JsonRpcProvider(
          "https://base-mainnet.g.alchemy.com/v2/OeF4gzEMrS-sF9IXBETZV",
          { chainId: 8453, name: 'base' },
          { staticNetwork: true }
        );
        const contract = new ethers.Contract(FANZTOKEN_V5_ADDRESS, FANZTOKEN_ABI, provider);

        // 각 주소에 대해 잔액 체크
        for (const address of userAddresses) {
          try {
            const accounts = tokenIds.map(() => address);
            const balances = (await contract.balanceOfBatch(accounts, tokenIds)) as bigint[];
            const total = balances.reduce((sum, b) => sum + Number(b), 0);
            
            if (total > 0) {
              console.log("[MiniAppHome] Lightstick found for address:", address, "total:", total);
              setHasLightstick(true);
              break;
            }
          } catch (err) {
            console.warn("[MiniAppHome] Balance check failed for", address, err);
          }
        }
      } catch (error) {
        console.error("[MiniAppHome] Error checking lightstick:", error);
      } finally {
        setIsCheckingLightstick(false);
      }
    };

    void checkLightstickOwnership();
  }, [userAddresses]);

  // 미청구 상금 조회
  useEffect(() => {
    if (userAddresses.length === 0) return;

    const fetchUnclaimedPrizes = async () => {
      setIsLoadingPrizes(true);
      try {
        // 지갑 주소로 external_wallet_users 조회
        const { data: walletUsers, error: walletError } = await supabase
          .from('external_wallet_users')
          .select('id, wallet_address')
          .in('wallet_address', userAddresses.map(a => a.toLowerCase()));

        if (walletError || !walletUsers || walletUsers.length === 0) {
          setIsLoadingPrizes(false);
          return;
        }

        const walletIds = walletUsers.map(w => w.id);

        // 미청구 당첨 정보 조회
        const { data: prizes, error: prizeError } = await supabase
          .from('external_challenge_participations')
          .select(`
            id,
            challenge_id,
            prize_amount,
            challenges!inner(question, admin_approved_at)
          `)
          .in('external_wallet_id', walletIds)
          .eq('is_winner', true)
          .is('claimed_at', null);

        if (prizeError || !prizes) {
          setIsLoadingPrizes(false);
          return;
        }

        // admin_approved_at이 있는 것만 필터링 (공개된 당첨만)
        const approvedPrizes = prizes.filter((p: any) => p.challenges?.admin_approved_at);
        
        setUnclaimedPrizes(approvedPrizes.map((p: any) => ({
          id: p.id,
          challenge_id: p.challenge_id,
          prize_amount: p.prize_amount || 0,
          challenge_question: p.challenges?.question || 'Challenge',
        })));
      } catch (err) {
        console.error("[MiniAppHome] Error fetching unclaimed prizes:", err);
      } finally {
        setIsLoadingPrizes(false);
      }
    };

    void fetchUnclaimedPrizes();
  }, [userAddresses]);

  // 상금 클레임 핸들러
  const handleClaimPrize = async (prize: UnclaimedPrize) => {
    if (userAddresses.length === 0) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setClaimingId(prize.id);
    
    try {
      const walletAddress = userAddresses[0];
      
      // 서명 요청
      const message = `Claim prize for challenge ${prize.challenge_id}\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      
      const provider = sdk.wallet.ethProvider;
      if (!provider) {
        throw new Error('Wallet provider not available');
      }

      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      }) as string;

      // Edge Function 호출
      const { data, error } = await supabase.functions.invoke('claim-external-prize', {
        body: {
          participationId: prize.id,
          walletAddress,
          message,
          signature,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Claim failed');

      toast({
        title: "Prize Claimed! 🎉",
        description: `$${prize.prize_amount} USDC sent to your wallet`,
      });

      // 클레임 목록에서 제거
      setUnclaimedPrizes(prev => prev.filter(p => p.id !== prize.id));
    } catch (err: any) {
      console.error("[MiniAppHome] Claim error:", err);
      toast({
        title: "Claim Failed",
        description: err.message || 'Please try again',
        variant: "destructive",
      });
    } finally {
      setClaimingId(null);
    }
  };

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['miniapp-active-challenges'],
    queryFn: async () => {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          id,
          question,
          total_prize_usdc,
          end_time,
          image_url,
          status,
          selected_at,
          answer_fetch_time,
          wiki_entry:wiki_entries(title, image_url)
        `)
        .in('status', ['active', 'ended', 'approved', 'test'])
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

      return (data || []).filter(isActiveWindow) as Challenge[];
    },
    refetchInterval: 30000,
  });

  const handleSelectChallenge = (challengeId: string) => {
    navigate(`/farcaster-app/${challengeId}`);
  };

  const handleClose = async () => {
    try {
      await sdk.actions.close();
    } catch {
      // 일반 브라우저에서는 닫기 불가
    }
  };


  const getTimeRemaining = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }
    return `${hours}h ${minutes}m left`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/miniapp')}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">Quiz Show</h1>
              <p className="text-xs text-white/70">K-Pop Trivia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Lightstick Holder Badge */}
            {!isCheckingLightstick && hasLightstick && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full px-3 py-1.5 shadow-lg">
                <Wand2 className="h-3.5 w-3.5 text-black" />
                <span className="text-xs font-bold text-black">Holder</span>
              </div>
            )}
            {/* K-Trendz.com 이동 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('https://k-trendz.com', '_blank')}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full px-3 h-9 text-xs font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Web
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-8">
        {/* 미청구 상금 섹션 */}
        {unclaimedPrizes.length > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-emerald-500/30 to-green-500/30 backdrop-blur-xl border border-emerald-400/50 rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Unclaimed Prizes</h2>
                  <p className="text-sm text-white/70">You have {unclaimedPrizes.length} prize(s) to claim!</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {unclaimedPrizes.map((prize) => (
                  <div
                    key={prize.id}
                    className="bg-white/10 rounded-2xl p-4 border border-white/10"
                  >
                    <p className="text-sm text-white/80 mb-3 line-clamp-2">
                      {prize.challenge_question}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-emerald-400">
                          ${prize.prize_amount.toFixed(2)}
                        </span>
                        <span className="text-sm text-white/60">USDC</span>
                      </div>
                      <Button
                        onClick={() => handleClaimPrize(prize)}
                        disabled={claimingId === prize.id}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-full px-5"
                      >
                        {claimingId === prize.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Claim
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Challenge List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
            <p className="text-white/70">Loading challenges...</p>
          </div>
        ) : challenges.length > 0 ? (
          <div className="space-y-5">
            {challenges.map((challenge, index) => {
              const imageUrl = challenge.image_url || challenge.wiki_entry?.image_url;
              const isFirst = index === 0;
              
              return (
                <button
                  key={challenge.id}
                  onClick={() => handleSelectChallenge(challenge.id)}
                  className="w-full text-left rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white/20 backdrop-blur-xl border border-white/30 shadow-xl"
                >
                  {/* Image Banner */}
                  {imageUrl && (
                    <div className="relative w-full aspect-[2/1] overflow-hidden">
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Featured Badge */}
                      {isFirst && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-lg">
                          <Trophy className="h-3.5 w-3.5 text-black" />
                          <span className="text-xs font-bold text-black uppercase tracking-wide">Featured</span>
                        </div>
                      )}
                      
                      {/* Prize Badge on Image */}
                      <div className="absolute bottom-3 right-3 bg-emerald-500 rounded-full px-4 py-2 flex items-center gap-1 shadow-lg">
                        <span className="text-lg font-bold text-white">${challenge.total_prize_usdc}</span>
                        <span className="text-xs text-white/90 font-medium">USDC</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-5">
                    {/* Question */}
                    <p className="text-white font-semibold text-lg leading-snug mb-4">
                      {challenge.question}
                    </p>
                    
                    {/* Bottom Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white/70">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">{getTimeRemaining(challenge.end_time)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                        <span className="text-sm font-semibold text-white">Play Now</span>
                        <ChevronRight className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    
                    {/* No Image fallback - show prize inline */}
                    {!imageUrl && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="bg-emerald-500 rounded-full px-3 py-1.5 flex items-center gap-1">
                          <span className="text-base font-bold text-white">${challenge.total_prize_usdc}</span>
                          <span className="text-xs text-white/90">USDC</span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5">
              <Trophy className="h-10 w-10 text-white/60" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Active Challenges</h2>
            <p className="text-white/70">Check back later for new trivia!</p>
          </div>
        )}
      </div>

      {/* 하단 Shop 배너 제거됨 - 허브 페이지에서 분기 */}
    </div>
  );
}
