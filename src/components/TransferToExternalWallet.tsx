import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle, ExternalLink, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TransferResult {
  tokenId: string;
  amount: string;
  txHash: string;
  name: string;
}

interface OnchainBalance {
  tokenId: string;
  balance: number;
  totalSupply: number;
  priceUsd: number;
  wikiEntryTitle?: string;
}

interface TransferToExternalWalletProps {
  externalWalletAddress: string;
  onTransferComplete?: () => void;
}

export const TransferToExternalWallet = ({
  externalWalletAddress,
  onTransferComplete,
}: TransferToExternalWalletProps) => {
  const { user } = useAuth();
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResults, setTransferResults] = useState<TransferResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [lightsticks, setLightsticks] = useState<OnchainBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 온체인 응원봉 잔액 조회 (V5 컨트랙트만)
  useEffect(() => {
    const fetchOnchainLightsticks = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // 1. 먼저 smart_wallet 주소 조회
        const { data: walletData } = await supabase
          .from('wallet_addresses')
          .select('wallet_address')
          .eq('user_id', user.id)
          .eq('wallet_type', 'smart_wallet')
          .limit(1)
          .maybeSingle();
        
        if (!walletData?.wallet_address) {
          console.log('No smart wallet found');
          setIsLoading(false);
          return;
        }

        // 2. V5 컨트랙트 토큰 목록 조회 (온체인 보유분 기준으로 필터링해서 표시)
        // - DB fanz_balances와 무관하게 "현재 온체인"에 있는 것만 보여주기 위함
        const { data: tokenList, error: tokenListError } = await supabase
          .from('fanz_tokens')
          .select('token_id, wiki_entries(title)')
          .eq('contract_address', '0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7');

        if (tokenListError) {
          console.error('Failed to fetch token list:', tokenListError);
          setIsLoading(false);
          return;
        }

        const tokenIds = Array.from(new Set((tokenList ?? []).map((t: any) => String(t.token_id))));

        if (tokenIds.length === 0) {
          setLightsticks([]);
          setIsLoading(false);
          return;
        }

        // 3. 온체인 잔액 조회
        // - userId를 넘기면 Edge Function이 지갑 후보를 과도하게 확장해서 RPC(Alchemy) rate limit(429)에 걸릴 수 있음
        // - 여기서는 "현재 K-Trendz Smart Wallet" 기준의 실잔액만 보여주면 되므로 walletAddress만 사용
        const { data, error } = await supabase.functions.invoke('get-user-fanz-balances', {
          body: {
            walletAddress: walletData.wallet_address,
            tokens: tokenIds.map((tokenId: string) => ({ tokenId })),
            includeMeta: false,
          },
        });

        if (error) {
          console.error('Failed to fetch onchain balances:', error);
          setIsLoading(false);
          return;
        }

        // 4. 잔액이 있는 토큰만 필터링하고 이름 매핑
        const tokenTitleMap = new Map<string, string>();
        (tokenList ?? []).forEach((t: any) => {
          tokenTitleMap.set(String(t.token_id), t.wiki_entries?.title || 'Lightstick');
        });

        const balancesWithNames = (data?.balances || [])
          .filter((b: any) => (b.balance || 0) > 0)
          .map((b: any) => ({
            ...b,
            wikiEntryTitle: tokenTitleMap.get(String(b.tokenId)) || 'Lightstick',
          }));

        setLightsticks(balancesWithNames);
      } catch (err) {
        console.error('Failed to fetch onchain lightsticks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnchainLightsticks();
  }, [user]);

  const totalLightsticks = lightsticks.reduce((sum, ls) => sum + ls.balance, 0);
  const hasLightsticks = totalLightsticks > 0;

  const handleTransfer = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setIsTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke('transfer-fanz-to-external', {});

      if (error) {
        throw new Error(error.message || 'Failed to transfer tokens');
      }

      if (data.transferredTokens && data.transferredTokens.length > 0) {
        setTransferResults(data.transferredTokens);
        setIsComplete(true);
        setLightsticks([]); // 전송 후 잔액 초기화
        toast.success(`Successfully transferred ${data.transferredTokens.length} Lightstick(s)!`);
      } else {
        toast.info('No tokens to transfer');
      }

      if (onTransferComplete) {
        onTransferComplete();
      }
    } catch (error: any) {
      console.error('Error transferring tokens:', error);
      toast.error(error?.message || 'Failed to transfer tokens');
    } finally {
      setIsTransferring(false);
    }
  };

  if (isComplete && transferResults.length > 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Transfer Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your Lightsticks have been transferred to your Base Wallet.
          </p>
          <div className="space-y-2">
            {transferResults.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <span className="text-sm font-medium">{result.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{result.amount}x</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(`https://basescan.org/tx/${result.txHash}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Transfer Lightsticks
        </CardTitle>
        <CardDescription>
          Move your Lightsticks from K-Trendz to your Base Wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">From</p>
            <Badge variant="outline" className="font-mono text-xs">
              K-Trendz Wallet
            </Badge>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">To Base Wallet</p>
            <Badge variant="secondary" className="font-mono text-xs bg-[#0052FF]/10 text-[#0052FF]">
              {externalWalletAddress.slice(0, 6)}...{externalWalletAddress.slice(-4)}
            </Badge>
          </div>
        </div>

        {/* 보유 응원봉 표시 */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">Your Lightsticks</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : hasLightsticks ? (
            <div className="flex flex-wrap gap-2">
              {lightsticks.map((ls) => (
                <Badge key={ls.tokenId} variant="secondary" className="text-xs">
                  🪄 {ls.wikiEntryTitle || 'Lightstick'} × {ls.balance}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Lightsticks to transfer</p>
          )}
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Note:</strong> This will transfer all your Lightsticks to your connected Base Wallet. 
            Gas fees are sponsored by the platform.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              className="w-full rounded-full"
              disabled={isTransferring || !hasLightsticks || isLoading}
            >
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  Transfer All Lightsticks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="mx-4 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
              <AlertDialogDescription>
                This will transfer all your Lightsticks ({totalLightsticks} total) from your K-Trendz Wallet to your connected Base Wallet. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleTransfer}
                className="rounded-full"
              >
                Confirm Transfer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default TransferToExternalWallet;
