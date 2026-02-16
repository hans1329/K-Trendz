import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, CreditCard, ExternalLink, AlertCircle, Coins, Lock, Check, Loader2, Wallet, DollarSign } from "lucide-react";
import { COMMUNITY_FUND_PERCENT, COMMUNITY_FUND_MIN_SUPPLY } from "@/hooks/useFanzTokenPrice";
import { useCoinbaseWallet } from "@/hooks/useCoinbaseWallet";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";

interface BuyFanzTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  onchainBuyCostUsd: number;
  reserveCostUsd?: number;
  artistFundFeeUsd?: number;
  platformFeeUsd?: number;
  currentSupply: number;
  onPurchaseSuccess: () => void;
}

type PaymentMethod = 'stripe' | 'crypto' | 'balance';

// Base 네트워크 로고 컴포넌트
const BaseLogo = ({ className }: { className?: string }) => (
  <svg 
    className={className}
    viewBox="0 0 111 111" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF"/>
    <path 
      d="M54.921 93.5C76.043 93.5 93.421 76.346 93.421 55.5C93.421 34.654 76.043 17.5 54.921 17.5C34.964 17.5 18.321 32.839 16.5 52.25H67.171V58.75H16.5C18.321 78.161 34.964 93.5 54.921 93.5Z" 
      fill="white"
    />
  </svg>
);

// 공통 Stripe 수수료 계산 함수 사용
import { calculateStripeTotal } from "@/hooks/useFanzTokenPrice";

// UUID를 온체인 tokenId로 변환
const uuidToTokenId = (uuid: string): bigint => {
  const hex = uuid.replace(/-/g, '');
  return BigInt('0x' + hex);
};

const BuyFanzTokenDialog = ({
  open,
  onOpenChange,
  tokenId,
  onchainBuyCostUsd,
  reserveCostUsd,
  artistFundFeeUsd,
  platformFeeUsd,
  currentSupply,
  onPurchaseSuccess
}: BuyFanzTokenDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFundInfoDialog, setShowFundInfoDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [walletType, setWalletType] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  
  const { 
    isConnecting, 
    isProcessing: isCryptoProcessing, 
    connectedAddress, 
    connectWallet, 
    buyWithUsdc 
  } = useCoinbaseWallet();

  // 지갑 타입 확인 + USDC 잔액 조회
  useEffect(() => {
    if (!open || !user) return;

    const fetchData = async () => {
      // 지갑 타입 조회
      const { data: smartWalletRow } = await supabase
        .from("wallet_addresses")
        .select("wallet_type")
        .eq("user_id", user.id)
        .eq("network", "base")
        .eq("wallet_type", "smart_wallet")
        .limit(1)
        .maybeSingle();

      if (smartWalletRow?.wallet_type) {
        setWalletType(smartWalletRow.wallet_type);
      } else {
        const { data: anyWalletRow } = await supabase
          .from("wallet_addresses")
          .select("wallet_type")
          .eq("user_id", user.id)
          .eq("network", "base")
          .limit(1)
          .maybeSingle();
        setWalletType(anyWalletRow?.wallet_type || "eoa");
      }

      // USDC 잔액 조회
      const { data: balanceData } = await supabase
        .from("usdc_balances")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      setUsdcBalance(balanceData?.balance || 0);
    };

    fetchData();
  }, [open, user]);

  const isEoaWallet = walletType === "eoa";

  // 100개 이상일 때만 커뮤니티 펀드 적립
  const isCommunityFundActive = currentSupply >= COMMUNITY_FUND_MIN_SUPPLY;
  
  // 커뮤니티 펀드 (온체인 구매가 기준)
  const communityFundAmount = isCommunityFundActive ? onchainBuyCostUsd * COMMUNITY_FUND_PERCENT : 0;
  
  // 최종 가격
  const baseWithFund = onchainBuyCostUsd + communityFundAmount;
  const stripePriceUsd = calculateStripeTotal(baseWithFund);
  const stripeFee = stripePriceUsd - baseWithFund;
  const cryptoPriceUsd = baseWithFund;
  const balancePriceUsd = baseWithFund; // USDC 잔액 결제 = 수수료 없음

  const hasEnoughBalance = usdcBalance >= balancePriceUsd;

  const handleStripePayment = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('create-fanztoken-checkout', {
        body: {
          tokenId,
          priceUsd: stripePriceUsd,
          tokenPriceUsd: onchainBuyCostUsd * 0.7,
          communityFundAmount,
          returnPath: location.pathname
        }
      });

      if (error) {
        let message = error.message;
        try {
          const maybeBody = await (error as any)?.context?.json?.();
          if (maybeBody?.error) message = maybeBody.error;
        } catch { /* noop */ }
        throw new Error(message);
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Failed to create payment session",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCryptoPayment = async () => {
    if (isCryptoProcessing) return;

    try {
      let address = connectedAddress;
      if (!address) {
        address = await connectWallet();
        if (!address) throw new Error('Failed to connect wallet');
      }

      const onChainTokenId = uuidToTokenId(tokenId);
      const txHash = await buyWithUsdc(tokenId, cryptoPriceUsd, onChainTokenId);
      
      await supabase.functions.invoke('record-crypto-fanztoken-purchase', {
        body: { tokenId, txHash, walletAddress: address, amountUsd: cryptoPriceUsd, communityFundAmount }
      });

      toast({ title: "Purchase Successful!", description: "Your LightStick has been added to your collection." });
      window.dispatchEvent(new CustomEvent('fanzTokenUpdated'));
      onPurchaseSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Crypto payment error:', error);
      toast({ title: "Payment Failed", description: error.message || 'Please try again', variant: "destructive" });
    }
  };

  // USDC 잔액으로 구매
  const handleBalancePayment = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const { data, error } = await supabase.functions.invoke('buy-fanztoken-with-balance', {
        body: { tokenId, communityFundAmount }
      });

      if (error) {
        let message = error.message;
        try {
          const maybeBody = await (error as any)?.context?.json?.();
          if (maybeBody?.error) message = maybeBody.error;
        } catch { /* noop */ }
        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);

      toast({ title: "Purchase Successful!", description: `LightStick purchased with $${(data?.totalDeducted || balancePriceUsd).toFixed(2)} from your balance.` });
      window.dispatchEvent(new CustomEvent('fanzTokenUpdated'));
      onPurchaseSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Balance payment error:', error);
      toast({ title: "Purchase Failed", description: error.message || 'Please try again', variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuy = () => {
    if (paymentMethod === 'stripe') handleStripePayment();
    else if (paymentMethod === 'crypto') handleCryptoPayment();
    else handleBalancePayment();
  };

  const currentPrice$ = paymentMethod === 'stripe' ? stripePriceUsd : paymentMethod === 'crypto' ? cryptoPriceUsd : balancePriceUsd;
  const isLoading = isProcessing || isConnecting || isCryptoProcessing;

  return (
    <>
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] p-0">
         <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Buy LightStick
          </DialogTitle>
          <DialogDescription>
            {isEoaWallet ? "Smart Wallet required" : "Choose your preferred payment method"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 flex-1">
          {/* EOA 유저에게 Smart Wallet 생성 안내 */}
          {isEoaWallet ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-destructive">Smart Wallet Required</p>
                    <p className="text-sm text-muted-foreground">
                      You need a Smart Wallet to buy LightSticks. Without it, you won't be able to sell your LightSticks later.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/wallet');
                }}
                className="w-full gap-2"
              >
                <Wallet className="w-4 h-4" />
                Create Smart Wallet
              </Button>
            </div>
          ) : (
          <div className="space-y-4 py-4">
            {/* 결제 방법 선택 - 3개 옵션 */}
            <div className={`grid gap-3 ${usdcBalance > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => setPaymentMethod('stripe')}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                  paymentMethod === 'stripe' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {paymentMethod === 'stripe' && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <CreditCard className="w-5 h-5 text-primary mb-1.5" />
                <p className="font-medium text-xs">Credit Card</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">via Stripe</p>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('crypto')}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                  paymentMethod === 'crypto' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {paymentMethod === 'crypto' && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <BaseLogo className="w-5 h-5 mb-1.5" />
                <p className="font-medium text-xs">Smart Wallet</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pay with USDC</p>
              </button>

              {/* USDC 잔액 결제 옵션 - 잔액이 있을 때만 표시 */}
              {usdcBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('balance')}
                  className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                    paymentMethod === 'balance' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {paymentMethod === 'balance' && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <DollarSign className="w-5 h-5 text-green-600 mb-1.5" />
                  <p className="font-medium text-xs">USDC Balance</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">${usdcBalance.toFixed(2)}</p>
                </button>
              )}
            </div>

            {/* 가격 정보 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Total Price</span>
                <span className="text-2xl font-bold text-primary">${currentPrice$.toFixed(2)}</span>
              </div>
              
              {/* 가격 상세 내역 */}
              <div className="space-y-2 px-2 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>LightStick Price (USDC)</span>
                  <span>${onchainBuyCostUsd.toFixed(2)}</span>
                </div>
                
                <div className="pl-3 space-y-1 text-xs text-muted-foreground/70 border-l-2 border-muted">
                  <div className="flex justify-between">
                    <span>├ Reserve (70%)</span>
                    <span>${(reserveCostUsd ?? onchainBuyCostUsd * 0.7).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>├ Artist Fund (20%)</span>
                    <span>${(artistFundFeeUsd ?? onchainBuyCostUsd * 0.2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>└ Platform (10%)</span>
                    <span>${(platformFeeUsd ?? onchainBuyCostUsd * 0.1).toFixed(2)}</span>
                  </div>
                </div>

                {/* 커뮤니티 펀드 */}
                {isCommunityFundActive ? (
                  <div className="flex justify-between items-center text-primary">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      Community Fund (+{(COMMUNITY_FUND_PERCENT * 100).toFixed(0)}%)
                    </span>
                    <span>+${communityFundAmount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div 
                    className="flex justify-between items-center text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => setShowFundInfoDialog(true)}
                  >
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <Coins className="w-3.5 h-3.5" />
                      Community Fund
                    </span>
                    <span className="text-xs">Locked</span>
                  </div>
                )}
                
                {/* 결제 수수료 */}
                {paymentMethod === 'stripe' && (
                  <div className="flex justify-between items-center text-muted-foreground border-t pt-2">
                    <span>Card Processing Fee</span>
                    <span>+${stripeFee.toFixed(2)}</span>
                  </div>
                )}
                {paymentMethod === 'crypto' && (
                  <div className="flex justify-between items-center text-green-600 border-t pt-2">
                    <span>Card Processing Fee</span>
                    <span>$0.00 ✓</span>
                  </div>
                )}
                {paymentMethod === 'balance' && (
                  <div className="flex justify-between items-center text-green-600 border-t pt-2">
                    <span>Processing Fee</span>
                    <span>$0.00 ✓</span>
                  </div>
                )}
              </div>

              {/* USDC 잔액 결제 시 잔액 정보 표시 */}
              {paymentMethod === 'balance' && (
                <div className={`flex justify-between items-center p-3 rounded-lg border ${
                  hasEnoughBalance ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'
                }`}>
                  <span className="text-sm text-muted-foreground">Your USDC Balance</span>
                  <span className={`font-semibold ${hasEnoughBalance ? 'text-green-600' : 'text-destructive'}`}>
                    ${usdcBalance.toFixed(2)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Current Supply</span>
                <span className="font-semibold">{currentSupply.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Purchase Amount</span>
                <span className="font-semibold">1 Token</span>
              </div>
            </div>

            {/* Crypto 결제 시 지갑 연결 상태 표시 */}
            {paymentMethod === 'crypto' && connectedAddress && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">
                  Wallet: {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                </span>
              </div>
            )}

            {/* 정보 메시지 */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                {paymentMethod === 'stripe' 
                  ? "After payment, your LightStick will be added to your collection. You can sell it anytime to receive USDC back."
                  : paymentMethod === 'crypto'
                    ? "You'll need USDC on Base network in your Smart Wallet. Gas fees are paid by you."
                    : "Your USDC balance (from quiz rewards, etc.) will be deducted. No additional fees apply."
                }
              </p>
            </div>
          </div>
          )}
        </div>

        {/* 액션 버튼 - EOA가 아닐 때만 */}
        {!isEoaWallet && (
          <div className="flex flex-col-reverse sm:flex-row gap-2 px-6 pb-6 pt-2 shrink-0 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuy}
              disabled={isLoading || (paymentMethod === 'balance' && !hasEnoughBalance)}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isConnecting ? 'Connecting...' : 'Processing...'}
                </>
              ) : paymentMethod === 'stripe' ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay ${stripePriceUsd.toFixed(2)}
                  <ExternalLink className="w-3 h-3" />
                </>
              ) : paymentMethod === 'crypto' ? (
                <>
                  <BaseLogo className="w-4 h-4" />
                  {connectedAddress ? `Pay $${cryptoPriceUsd.toFixed(2)}` : 'Connect & Pay'}
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  {hasEnoughBalance ? `Pay $${balancePriceUsd.toFixed(2)}` : 'Insufficient Balance'}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Community Fund Info Dialog */}
    <AlertDialog open={showFundInfoDialog} onOpenChange={setShowFundInfoDialog}>
      <AlertDialogContent className="max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            Community Fund Locked
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              The Community Fund for this artist will be activated once <strong>{COMMUNITY_FUND_MIN_SUPPLY} LightStick holders</strong> are reached.
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Current Holders</span>
                <span className="font-semibold">{currentSupply} / {COMMUNITY_FUND_MIN_SUPPLY}</span>
              </div>
              <div className="mt-2 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((currentSupply / COMMUNITY_FUND_MIN_SUPPLY) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {COMMUNITY_FUND_MIN_SUPPLY - currentSupply > 0 
                  ? `${COMMUNITY_FUND_MIN_SUPPLY - currentSupply} more needed to unlock`
                  : 'Unlocked!'
                }
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Once unlocked, 10% of each purchase will be contributed to the Community Fund for fan events and activities.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default BuyFanzTokenDialog;
