import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wand2, Star, Users, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFanzTokenPrice } from "@/hooks/useFanzTokenPrice";
import { useAuth } from "@/hooks/useAuth";

import BuyFanzTokenDialog from "./BuyFanzTokenDialog";
import FanzTokenHoldersDialog from "./FanzTokenHoldersDialog";
import PurchaseCelebrationDialog from "./PurchaseCelebrationDialog";
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

interface FanzTokenButtonProps {
  wikiEntryId: string;
  userId: string | null;
  creatorId: string;
  ownerId?: string | null;
  pageStatus?: string | null;
  votes?: number;
  followerCount: number;
  onFollowChange?: () => void;
  entryTitle?: string;
  onIssuingChange?: (isIssuing: boolean) => void;
}

const FanzTokenButton = ({
  wikiEntryId,
  userId,
  creatorId,
  ownerId,
  pageStatus,
  votes,
  followerCount,
  onFollowChange,
  entryTitle = "",
  onIssuingChange
}: FanzTokenButtonProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const { isAdmin } = useAuth();
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showHoldersDialog, setShowHoldersDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCelebrationDialog, setShowCelebrationDialog] = useState(false);
  const [newTokenBalance, setNewTokenBalance] = useState(1);
  const isMobile = useIsMobile();

  // isProcessing 상태 변경을 부모에게 알림
  useEffect(() => {
    if (onIssuingChange) {
      onIssuingChange(isProcessing);
    }
  }, [isProcessing, onIssuingChange]);

  // issue_lightstick 규칙 조회
  const { data: issueRule } = useQuery({
    queryKey: ['point-rule-issue-lightstick'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('point_rules')
        .select('points')
        .eq('action_type', 'issue_lightstick')
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // 사용자 프로필 조회 (Stars 잔액 + 축하 팝업용 정보)
  const { data: profile } = useQuery({
    queryKey: ['profile-for-fanztoken', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('available_points, display_name, username, avatar_url')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // 토큰 정보 조회
  const {
    data: fanzToken,
    isLoading: isLoadingToken,
    error: tokenError
  } = useQuery({
    queryKey: ['fanz-token', wikiEntryId],
    queryFn: async () => {
      console.log('🔍 Fetching fanz token for wiki_entry_id:', wikiEntryId);
      const {
        data,
        error
      } = await supabase.from('fanz_tokens').select('*').eq('wiki_entry_id', wikiEntryId).eq('is_active', true).maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching fanz token:', error);
        throw error;
      }
      console.log('✅ Fanz token data:', data);
      if (data) {
        console.log('✅ Full token object:', JSON.stringify(data, null, 2));
      }
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });

  // 사용자가 팔로우했는지 확인
  const {
    data: isFollowing,
    refetch: refetchFollowStatus
  } = useQuery({
    queryKey: ['wiki-entry-follow', wikiEntryId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const {
        data,
        error
      } = await supabase.from('wiki_entry_followers').select('id').eq('wiki_entry_id', wikiEntryId).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId
  });

  // 오늘의 첫 거래 가격 조회 (등락 폭 계산용 - 오늘 시작 시점 가격과 현재 가격 비교)
  const { data: todayFirstTransaction } = useQuery({
    queryKey: ['fanz-token-today-first-transaction', fanzToken?.id],
    queryFn: async () => {
      if (!fanzToken?.id) return null;
      
      // 오늘 0시 (UTC 기준)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('fanz_transactions')
        .select('price_per_token, created_at')
        .eq('fanz_token_id', fanzToken.id)
        .eq('transaction_type', 'buy')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    enabled: !!fanzToken?.id,
  });

  // 통합된 가격 훅 사용 (온체인 가격 + 커뮤니티 펀드 + Stripe 수수료 포함)
  const {
    buyCostUsd,
    priceInUSD,
    priceWithStripeUSD,
    priceWithFundUSD,
    communityFundAmount,
    platformFeeAmount,
    reserveAmount,
    totalSupply,
    userHeldSupply,
    isLoading: isLoadingPrice,
    isError: isPriceError
  } = useFanzTokenPrice(wikiEntryId);

  console.log("💰 Fanz token data:", {
    fanzToken,
    basePrice: fanzToken?.base_price,
    kValue: fanzToken?.k_value,
    totalSupply,
    userHeldSupply,
  });
  
  console.log("💰 Fanz price debug (with 10% fund):", {
    buyCostUsd,
    priceInUSD,
    priceWithFundUSD,
    communityFundAmount,
    priceWithStripeUSD,
    totalSupply,
    userHeldSupply,
  });

  // 가격 포맷팅 (소수점 둘째 자리 고정)
  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined || !Number.isFinite(price)) return "--";

    // Intl 포맷터를 사용해 과학적 표기(e+41) 대신 항상 소수 2자리로 표시
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const priceDisplayText =
    isLoadingToken || isLoadingPrice ? "Loading..." : formatPrice(priceWithStripeUSD);

  // 가격 변동률 계산 (오늘의 첫 거래 가격 대비 현재 표시 가격)
  // - UI에 표시되는 값(priceWithStripeUSD)과 같은 기준으로 비교해야 등락이 뒤집히지 않습니다.
  const priceChange = (() => {
    const defaultChange = { percent: 0, isUp: true };

    // Rankings 티커와 동일: 공급량이 0일 때만 0% 표시
    // - 0: 아직 거래가 없음
    // - 1 이상: 오늘 첫 거래 대비 변동률 계산
    if (totalSupply === null || totalSupply === 0) {
      return defaultChange;
    }

    // 현재 표시 가격이 없으면 0% 표시
    if (
      priceWithStripeUSD === null ||
      priceWithStripeUSD === undefined ||
      !Number.isFinite(priceWithStripeUSD)
    ) {
      return defaultChange;
    }

    // 오늘 거래가 없으면 0% 표시 (오늘 첫 거래 시점이 기준이므로)
    if (!todayFirstTransaction?.price_per_token) {
      return defaultChange;
    }

    const todayStartPrice = Number(todayFirstTransaction.price_per_token);
    if (!Number.isFinite(todayStartPrice) || todayStartPrice <= 0) {
      return defaultChange;
    }

    const changePercent = ((priceWithStripeUSD - todayStartPrice) / todayStartPrice) * 100;
    if (!Number.isFinite(changePercent)) return defaultChange;

    return {
      percent: Math.abs(changePercent),
      isUp: changePercent >= 0,
    };
  })();

  // creator 또는 owner 또는 관리자이면 발행 가능 (단, 잠금 해제 상태에서만)
  // - 잠금 해제: claimed/verified 또는 투표 1000+ 달성
  const isUnlocked =
    pageStatus === 'claimed' ||
    pageStatus === 'verified' ||
    (votes ?? 0) >= 1000;
  const isCreator = isUnlocked && (userId === creatorId || (ownerId && userId === ownerId) || isAdmin);

  // 결제 성공 후 리다이렉트 감지 및 DB에서 실제 거래 상태 확인
  // payment=success 파라미터가 있으면 fanzToken 로딩을 기다린 후 처리
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    
    // fanzToken이 아직 로딩 중이면 대기 (의존성 배열에 의해 로딩 완료 후 재실행됨)
    if (paymentStatus === 'success' && isLoadingToken) {
      console.log('⏳ Payment success detected, waiting for fanzToken to load...');
      return;
    }
    
    if (paymentStatus === 'success' && userId && wikiEntryId) {
      console.log('🔄 Payment success detected, starting polling for transaction status...', { fanzTokenId: fanzToken?.id, wikiEntryId });
      
      let pollCount = 0;
      const maxPolls = 30; // 최대 30초 폴링
      
      // 폴링 로직: 1초마다 최근 거래 상태 확인
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // fanzToken이 아직 없으면 wikiEntryId로 조회
        let tokenId = fanzToken?.id;
        if (!tokenId) {
          const { data: tokenData } = await supabase
            .from('fanz_tokens')
            .select('id')
            .eq('wiki_entry_id', wikiEntryId)
            .eq('is_active', true)
            .maybeSingle();
          tokenId = tokenData?.id;
        }
        
        if (!tokenId) {
          console.log('🔄 Poll', pollCount, '- Token not found yet');
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            searchParams.delete('payment');
            setSearchParams(searchParams, { replace: true });
            toast({
              title: "Purchase pending",
              description: "Your purchase is being processed. Please check back shortly.",
            });
          }
          return;
        }
        
        // 최근 5분 이내의 해당 사용자 거래 조회
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentTx, error } = await supabase
          .from('fanz_transactions')
          .select('id, transaction_type, amount, created_at, tx_hash, stripe_payment_intent_id')
          .eq('fanz_token_id', tokenId)
          .eq('user_id', userId)
          .eq('transaction_type', 'buy')
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        console.log('🔄 Poll', pollCount, '- Recent transaction:', recentTx);
        
        if (recentTx && recentTx.tx_hash) {
          // 온체인 거래가 완료됨 (tx_hash 있음)
          clearInterval(pollInterval);
          
          console.log('✅ Transaction confirmed with tx_hash:', recentTx.tx_hash);
          
          // URL에서 payment 파라미터 제거
          searchParams.delete('payment');
          setSearchParams(searchParams, { replace: true });
          
          // 온체인 데이터 새로고침
          if (fanzToken) {
            queryClient.invalidateQueries({ 
              queryKey: ['fanz-token-onchain-price', fanzToken.id, fanzToken.token_id] 
            });
          }
          
          // 사용자의 현재 잔액 조회
          const { data: balanceData } = await supabase
            .from('fanz_balances')
            .select('balance')
            .eq('user_id', userId)
            .eq('fanz_token_id', tokenId)
            .maybeSingle();
          
          setNewTokenBalance(balanceData?.balance || 1);
          setShowCelebrationDialog(true);
        } else if (pollCount >= maxPolls) {
          // 최대 시간 초과 - 환불 여부 확인
          clearInterval(pollInterval);
          
          console.log('⏱️ Polling timeout. Checking for refund status...');
          
          // 실패 알림 확인
          const { data: failNotification } = await supabase
            .from('notifications')
            .select('id, message')
            .eq('user_id', userId)
            .eq('type', 'fanz_purchase_failed')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          searchParams.delete('payment');
          setSearchParams(searchParams, { replace: true });
          
          if (failNotification) {
            // 환불 처리된 경우
            console.log('⚠️ Refund detected:', failNotification);
            toast({
              title: "Purchase failed - Refunded",
              description: failNotification.message || "Your payment has been automatically refunded.",
              variant: "destructive",
            });
            // 알림 읽음 처리
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('id', failNotification.id);
          } else if (!recentTx) {
            // 거래 자체가 없는 경우 - 온체인 실패 후 환불
            toast({
              title: "Purchase failed",
              description: "There was an issue with the blockchain transaction. If you were charged, a refund will be processed automatically.",
              variant: "destructive",
            });
          } else {
            // 거래는 있지만 tx_hash가 없는 경우 - 아직 처리 중
            toast({
              title: "Purchase pending",
              description: "Your purchase is still being processed. Please check back in a few minutes.",
            });
          }
        }
      }, 1000);
      
      return () => clearInterval(pollInterval);
    } else if (paymentStatus === 'cancelled') {
      // URL에서 payment 파라미터 제거
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
      
      toast({
        title: "Payment cancelled",
        description: "Your payment was not completed",
        variant: "destructive",
      });
    }
  }, [searchParams, setSearchParams, queryClient, wikiEntryId, userId, toast, fanzToken, isLoadingToken]);

  // 토큰 발행하기 - 확인 다이얼로그 표시
  const handleIssueTokenClick = () => {
    if (!userId) {
      toast({
        title: "Login Required",
        description: "Please login to issue lightstick",
        variant: "destructive"
      });
      return;
    }

    // Stars 부족 체크
    const issueCost = Math.abs(issueRule?.points || -100);
    const hasEnoughPoints = profile?.available_points !== undefined && profile.available_points >= issueCost;
    
    if (!hasEnoughPoints) {
      toast({
        title: "Insufficient Stars",
        description: `You need ${issueCost} Stars to issue a lightstick token. Current balance: ${profile?.available_points || 0} Stars`,
        variant: "destructive"
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  // 확인 후 실제 발행
  const handleConfirmIssue = async () => {
    setShowConfirmDialog(false);
    setIsProcessing(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('issue-fanz-token', {
        body: {
          wikiEntryId
        }
      });
      if (error) throw error;
      toast({
        title: "Lightstick Issued!",
        description: "Your lightstick token has been created successfully"
      });

      // Refetch token info
      window.location.reload();
    } catch (error: any) {
      console.error('Error issuing token:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to issue lightstick",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Fan Up (팔로우)
  const handleFanUp = async () => {
    if (!userId) {
      toast({
        title: "Login Required",
        description: "Please login to become a fan",
        variant: "destructive"
      });
      return;
    }
    if (isFollowing) {
      return;
    }
    setIsProcessing(true);
    try {
      const {
        error
      } = await supabase.from('wiki_entry_followers').insert({
        wiki_entry_id: wikiEntryId,
        user_id: userId
      }).select().single();
      if (error && !error.message.includes('duplicate key')) throw error;
      toast({
        title: "Fanned Up!",
        description: "You are now a fan!"
      });
      await refetchFollowStatus();
      if (onFollowChange) {
        onFollowChange();
      }
    } catch (error: any) {
      console.error('Error toggling fan status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update fan status",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 응원봉 구매하기
  const handleBuyToken = async () => {
    if (!userId) {
      toast({
        title: "Login Required",
        description: "Please login to buy lightstick",
        variant: "destructive"
      });
      return;
    }
 
    if (
      priceInUSD === null ||
      priceInUSD <= 0
    ) {
      toast({
        title: "Price unavailable",
        description: "Unable to fetch token price. Please try again later.",
        variant: "destructive",
      });
      return;
    }
 
    setShowBuyDialog(true);
  };

  const handlePurchaseSuccess = () => {
    // Webhook이 처리하므로 페이지 리로드로 최신 데이터 가져오기
    window.location.reload();
  };

  // 생성자이고 토큰 미발행
  if (isCreator && !fanzToken) {
    const issueCost = Math.abs(issueRule?.points || -100);
    const hasEnoughPoints = profile?.available_points !== undefined && profile.available_points >= issueCost;

    return (
      <>
        <Button
          variant="default" 
          onClick={handleIssueTokenClick} 
          disabled={isProcessing} 
          className="gap-2"
        >
          <Wand2 className="w-4 h-4" />
          Issue Lightstick
        </Button>

        {/* 발행 확인 다이얼로그 */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Issue Lightstick Token</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <div className="text-foreground">
                  Issuing a lightstick token will deduct <strong className="text-primary">{issueCost} Stars</strong> from your balance.
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    <span>{profile?.available_points || 0}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">After Issuance</span>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    <span>{(profile?.available_points || 0) - issueCost}</span>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmIssue}>
                Confirm Issue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // 토큰 미발행이면 null (생성자만 발행 가능)
  if (!fanzToken) {
    console.log('⚠️ No fanzToken found. isLoadingToken:', isLoadingToken, 'tokenError:', tokenError);
    return null;
  }
  
  // 토큰 발행 후 - 토큰 버튼은 팔로워만 표시
  // 단, Stripe 결제 완료 후 축하 모달은 팔로우 여부와 무관하게 표시되어야 함
  if (!isFollowing) {
    console.log('🚫 Token exists but user is not following. Hiding token button UI.');
    return (
      <PurchaseCelebrationDialog
        open={showCelebrationDialog}
        onOpenChange={setShowCelebrationDialog}
        entryTitle={entryTitle}
        userName={profile?.display_name || profile?.username || 'Fan'}
        userAvatar={profile?.avatar_url || undefined}
        tokenBalance={newTokenBalance}
      />
    );
  }
  
  console.log('🎫 Rendering FanzToken button with supply:', fanzToken.total_supply);

  // 토큰 발행 후 + 팔로워 - 토큰 버튼 표시
  return (
    <>
      <div className={`flex items-center bg-black/70 border border-white/20 shadow-sm hover:shadow-md transition-all ${
        isMobile ? 'gap-2 px-2 py-1 rounded-full' : 'gap-3 px-2.5 py-1.5 rounded-full'
      }`}>
        {/* 왼쪽 통계 버튼 */}
        <button
          onClick={() => setShowHoldersDialog(true)}
          className={`flex-shrink-0 rounded-full border border-white/30 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors ${
            isMobile ? 'w-8 h-8 mr-2' : 'w-10 h-10 mr-3'
          }`}
          title="Lightstick Info"
        >
          <Users className={isMobile ? 'w-4 h-4 text-white/70' : 'w-5 h-5 text-white/70'} />
        </button>

        {/* 중간 서플라이/가격 영역 */}
        <div className={`flex items-center ${isMobile ? 'gap-2 px-1 mr-2' : 'gap-4 mr-3'}`}>
          <div className={`text-right ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <div className={`text-white/60 mb-0.5 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Supply</div>
            <div className="font-bold text-white">{isLoadingPrice ? '...' : (totalSupply ?? 0).toLocaleString()}</div>
          </div>
          <div className={`border-l border-white/30 text-right ${isMobile ? 'pl-2 text-xs' : 'pl-4 text-sm'}`}>
            <div className={`text-white/60 mb-0.5 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Price</div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="font-bold text-white">{priceDisplayText}</span>
              <span
                className={`flex items-center gap-0.5 ${
                  isMobile ? "text-[10px]" : "text-xs"
                } font-bold ${priceChange.isUp ? "text-green-400" : "text-red-400"}`}
              >
                {priceChange.isUp ? (
                  <TrendingUp className={isMobile ? "w-2.5 h-2.5" : "w-3 h-3"} />
                ) : (
                  <TrendingDown className={isMobile ? "w-2.5 h-2.5" : "w-3 h-3"} />
                )}
                {Math.abs(priceChange.percent).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽 구매 버튼 */}
        <button
          onClick={handleBuyToken}
          disabled={isProcessing || isLoadingPrice || priceWithStripeUSD <= 0}
          className="relative flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className={`rounded-full bg-primary flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors ${
            isMobile ? 'px-3 h-9' : 'px-4 h-12'
          }`}>
            <Wand2 className={isMobile ? 'w-4 h-4 text-white' : 'w-5 h-5 text-white'} />
            <span className={`text-white font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>Support</span>
          </div>
        </button>
      </div>

      {fanzToken && buyCostUsd && buyCostUsd > 0 && totalSupply !== null && (
        <BuyFanzTokenDialog
          open={showBuyDialog}
          onOpenChange={setShowBuyDialog}
          tokenId={fanzToken.id}
          onchainBuyCostUsd={buyCostUsd}
          reserveCostUsd={reserveAmount ?? undefined}
          artistFundFeeUsd={communityFundAmount ?? undefined}
          platformFeeUsd={platformFeeAmount ?? undefined}
          currentSupply={totalSupply}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}

      {fanzToken && (
        <FanzTokenHoldersDialog
          open={showHoldersDialog}
          onOpenChange={setShowHoldersDialog}
          tokenId={fanzToken.id}
          tokenStringId={fanzToken.token_id || ''}
          entryTitle={entryTitle}
        />
      )}

      {/* 구매 축하 팝업 */}
      <PurchaseCelebrationDialog
        open={showCelebrationDialog}
        onOpenChange={setShowCelebrationDialog}
        entryTitle={entryTitle}
        userName={profile?.display_name || profile?.username || 'Fan'}
        userAvatar={profile?.avatar_url || undefined}
        tokenBalance={newTokenBalance}
      />
    </>
  );
};

export default FanzTokenButton;
