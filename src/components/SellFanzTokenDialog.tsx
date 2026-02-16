import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, TrendingDown, Loader2, DollarSign } from "lucide-react";

interface SellFanzTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  onchainTokenId: string; // 온체인 토큰 ID 추가
  currentSupply: number;
  availableBalance: number;
  onSellSuccess: () => void;
}

const SellFanzTokenDialog = ({
  open,
  onOpenChange,
  tokenId,
  onchainTokenId,
  currentSupply,
  availableBalance,
  onSellSuccess
}: SellFanzTokenDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  // V4: grossRefund (Reserve), platformFee (4%), netRefund (User receives)
  const [sellGrossRefund, setSellGrossRefund] = useState<number | null>(null);
  const [sellPlatformFee, setSellPlatformFee] = useState<number | null>(null);
  const [sellNetRefund, setSellNetRefund] = useState<number | null>(null);

  // AMM 방식이므로 1개만 판매
  const amount = 1;

  // 온체인에서 판매 가격 조회
  useEffect(() => {
    const fetchSellPrice = async () => {
      if (!open || !onchainTokenId || currentSupply <= 0) {
        setSellGrossRefund(null);
        setSellPlatformFee(null);
        setSellNetRefund(null);
        return;
      }

      setIsLoadingPrice(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-fanztoken-price', {
          body: { tokenId: onchainTokenId, amount: 1 }
        });

        if (error) throw error;
        
        if (data?.success && data?.data) {
          // V4: 직접 반환된 값 사용
          setSellGrossRefund(data.data.sellGrossRefund || 0);
          setSellPlatformFee(data.data.sellPlatformFee || 0);
          setSellNetRefund(data.data.sellNetRefund || 0);
        }
      } catch (error) {
        console.error('Error fetching sell price:', error);
        setSellGrossRefund(null);
        setSellPlatformFee(null);
        setSellNetRefund(null);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchSellPrice();
  }, [open, onchainTokenId, currentSupply]);

  // V4: 온체인에서 직접 반환된 값 사용
  const reserveAmount = sellGrossRefund;
  const platformFee = sellPlatformFee;
  const userRefund = sellNetRefund;

  const canSell = availableBalance >= amount && currentSupply > 0 && userRefund !== null && userRefund > 0;

  const handleSell = async () => {
    if (!canSell) {
      toast.error("Cannot sell", {
        description: `You need ${amount} token(s) but only have ${availableBalance}`
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sell-fanz-token', {
        body: { tokenId, amount }
      });

      if (error) throw error;

      toast.success("Sale Successful!", {
        description: `You received $${data.refundUsd.toFixed(2)} USDC`
      });

      onSellSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error selling token:', error);
      
      const errorMessage = error.message || '';
      
      // 레거시 토큰 에러 처리
      if (errorMessage.includes('LEGACY_TOKEN_NOT_SUPPORTED')) {
        toast.error("Legacy Token Not Supported", {
          description: "This lightstick token was created before the on-chain upgrade and cannot be sold. Only newly issued tokens can be sold."
        });
      }
      // 플랫폼 가스비 부족 에러
      else if (errorMessage.includes('PLATFORM_GAS_INSUFFICIENT')) {
        toast.error("Platform Gas Unavailable", {
          description: "Platform is temporarily unable to process sales. Please try again later."
        });
      }
      // 월렛 키 불일치 에러 (레거시 월렛 문제)
      else if (errorMessage.includes('Wallet deployment blocked') || errorMessage.includes('Wallet mismatch')) {
        toast.error("Wallet Key Mismatch", {
          description: "Your wallet needs to be regenerated. Please go to Wallet page and click 'Regenerate Wallet'. Note: Existing tokens on the old wallet may be lost.",
          duration: 10000
        });
      }
      // 기타 에러
      else {
        toast.error("Sale Failed", {
          description: errorMessage || "Failed to sell lightstick token"
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            Sell Lightstick Token
          </DialogTitle>
          <DialogDescription>
            Sell your lightstick tokens and receive USDC to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Supply</span>
              <span className="font-semibold">{currentSupply}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Balance</span>
              <span className="font-semibold flex items-center gap-1">
                <Wand2 className="w-4 h-4 text-primary" />
                {availableBalance}
              </span>
            </div>
          </div>

          {/* V3: 판매 수수료 내역 */}
          <div className="bg-primary/5 p-4 rounded-lg space-y-2 border border-primary/20">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tokens to Sell</span>
              <span className="font-semibold">1</span>
            </div>
            
            {isLoadingPrice ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading on-chain price...</span>
              </div>
            ) : userRefund !== null && reserveAmount !== null && platformFee !== null ? (
              <>
                {/* Reserve Amount */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reserve Amount</span>
                  <span className="font-semibold">${reserveAmount.toFixed(2)}</span>
                </div>
                
                {/* 수수료 분배 설명 */}
                <div className="pl-3 space-y-1 text-xs text-muted-foreground/70 border-l-2 border-muted">
                  <div className="flex justify-between">
                    <span>└ Platform Fee (4%)</span>
                    <span>-${platformFee.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">You will receive (96%)</span>
                  <div className="text-right">
                    <div className="font-bold text-primary flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {userRefund.toFixed(2)} USDC
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {currentSupply === 0 ? "No tokens in circulation to sell" : "Unable to fetch on-chain price"}
              </p>
            )}
            
            {!canSell && userRefund !== null && (
              <p className="text-xs text-destructive mt-2">
                {currentSupply === 0 ? "No tokens in circulation" : availableBalance < amount ? "Insufficient token balance" : ""}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSell}
              disabled={isProcessing || isLoadingPrice || !canSell}
              variant="destructive"
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Selling...
                </>
              ) : isLoadingPrice ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Sell Now"
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            USDC will be sent directly to your connected wallet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SellFanzTokenDialog;
