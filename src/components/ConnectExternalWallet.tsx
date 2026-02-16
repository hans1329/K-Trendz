import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, ExternalLink, Wallet, Shield } from 'lucide-react';
import { useCoinbaseWallet } from '@/hooks/useCoinbaseWallet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ConnectExternalWalletProps {
  onConnected?: (address: string) => void;
  showCard?: boolean;
  variant?: 'default' | 'compact' | 'banner';
}

export const ConnectExternalWallet = ({ 
  onConnected, 
  showCard = true,
  variant = 'default'
}: ConnectExternalWalletProps) => {
  const { user } = useAuth();
  const { connectWallet, signMessageForLogin, isConnecting } = useCoinbaseWallet();
  const [externalWallet, setExternalWallet] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 기존 연결된 외부 지갑 조회
  useEffect(() => {
    const fetchExternalWallet = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('wallet_addresses')
          .select('wallet_address')
          .eq('user_id', user.id)
          .eq('wallet_type', 'external')
          .maybeSingle();

        if (!error && data) {
          setExternalWallet(data.wallet_address);
        }
      } catch (error) {
        console.error('Error fetching external wallet:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExternalWallet();
  }, [user]);

  const handleConnectWallet = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setIsLinking(true);
    try {
      // 1. Coinbase Wallet 연결
      const address = await connectWallet();
      if (!address) {
        throw new Error('Failed to connect wallet');
      }

      // 2. 서명으로 소유권 증명
      const { signature, nonce } = await signMessageForLogin(address);

      // 3. Edge Function으로 검증 및 저장
      const { data, error } = await supabase.functions.invoke('link-external-wallet', {
        body: {
          walletAddress: address,
          signature,
          nonce,
          linkToExisting: true // 기존 계정에 연결
        }
      });

      // Edge Function 에러 처리: 400 에러 시 data에 에러 메시지가 포함됨
      if (error) {
        // FunctionsHttpError의 경우 context에서 상세 메시지 추출 시도
        const errorBody = (error as any).context?.body;
        if (errorBody) {
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed?.error) {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            // JSON 파싱 실패 시 원래 에러 사용
          }
        }
        throw new Error(error.message || 'Failed to link wallet');
      }

      // 성공하지 않은 경우 (data에 에러가 있는 경우)
      if (data?.error) {
        throw new Error(data.error);
      }

      setExternalWallet(address.toLowerCase());
      toast.success('Wallet connected successfully!');
      
      if (onConnected) {
        onConnected(address.toLowerCase());
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      
      // 사용자 취소 시 에러 메시지 표시하지 않음
      const isUserRejection = 
        error?.message?.includes('User rejected') ||
        error?.message?.includes('rejected') ||
        error?.message?.includes('ACTION_REJECTED') ||
        error?.code === 4001 ||
        error?.code === 'ACTION_REJECTED';
      
      if (isUserRejection) {
        return;
      }
      
      toast.error(error?.message || 'Failed to connect wallet');
    } finally {
      setIsLinking(false);
    }
  };

  const openExplorer = () => {
    if (externalWallet) {
      window.open(`https://basescan.org/address/${externalWallet}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 이미 연결된 경우
  if (externalWallet) {
    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">Connected:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {externalWallet.slice(0, 6)}...{externalWallet.slice(-4)}
          </code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openExplorer}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (!showCard) {
      return (
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">External Wallet Connected</p>
            <code className="text-xs text-muted-foreground truncate block">
              {externalWallet}
            </code>
          </div>
          <Button variant="ghost" size="icon" onClick={openExplorer}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              External Wallet Connected
            </CardTitle>
            <Badge variant="secondary" className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20">
              Base
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded-lg text-xs break-all">
              {externalWallet}
            </code>
            <Button variant="outline" size="icon" onClick={openExplorer}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This wallet will be used for withdrawals with your direct signature.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 연결되지 않은 경우 - 배너 스타일
  if (variant === 'banner') {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gradient-to-r from-[#0052FF]/10 to-primary/10 border border-[#0052FF]/20 rounded-lg">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-[#0052FF]/20 rounded-full shrink-0">
            <Shield className="h-5 w-5 text-[#0052FF]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Connect Your Base Wallet</p>
            <p className="text-xs text-muted-foreground">
              For secure withdrawals with your own signature
            </p>
          </div>
        </div>
        <Button 
          onClick={handleConnectWallet} 
          disabled={isConnecting || isLinking}
          className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white shrink-0 w-full sm:w-auto"
        >
          {(isConnecting || isLinking) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <circle cx="55.5" cy="55.5" r="55.5" fill="white"/>
                <path d="M55.3646 92.5C75.3646 92.5 91.3646 76.5 91.3646 56.5C91.3646 36.5 75.3646 20.5 55.3646 20.5C36.5646 20.5 21.3646 34.7 19.5646 52.9H67.3646V60.1H19.5646C21.3646 78.3 36.5646 92.5 55.3646 92.5Z" fill="#0052FF"/>
              </svg>
              Connect Wallet
            </>
          )}
        </Button>
      </div>
    );
  }

  // 연결되지 않은 경우 - 기본 스타일
  if (!showCard) {
    return (
      <Button 
        onClick={handleConnectWallet} 
        disabled={isConnecting || isLinking}
        className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white"
      >
        {(isConnecting || isLinking) ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <circle cx="55.5" cy="55.5" r="55.5" fill="white"/>
              <path d="M55.3646 92.5C75.3646 92.5 91.3646 76.5 91.3646 56.5C91.3646 36.5 75.3646 20.5 55.3646 20.5C36.5646 20.5 21.3646 34.7 19.5646 52.9H67.3646V60.1H19.5646C21.3646 78.3 36.5646 92.5 55.3646 92.5Z" fill="#0052FF"/>
            </svg>
            Connect Base Wallet
          </>
        )}
      </Button>
    );
  }

  return (
    <Card className="border-[#0052FF]/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#0052FF]" />
            Connect External Wallet
          </CardTitle>
          <Badge variant="secondary" className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20">
            Base
          </Badge>
        </div>
        <CardDescription>
          Connect your Coinbase Wallet for secure withdrawals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>More Secure:</strong> Withdraw directly to your wallet with your own signature
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Gas Free:</strong> Platform sponsors all transaction fees
            </p>
          </div>
        </div>

        <Button 
          onClick={handleConnectWallet} 
          disabled={isConnecting || isLinking}
          className="w-full bg-[#0052FF] hover:bg-[#0052FF]/90 text-white"
        >
          {(isConnecting || isLinking) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <circle cx="55.5" cy="55.5" r="55.5" fill="white"/>
                <path d="M55.3646 92.5C75.3646 92.5 91.3646 76.5 91.3646 56.5C91.3646 36.5 75.3646 20.5 55.3646 20.5C36.5646 20.5 21.3646 34.7 19.5646 52.9H67.3646V60.1H19.5646C21.3646 78.3 36.5646 92.5 55.3646 92.5Z" fill="#0052FF"/>
              </svg>
              Connect Base Wallet
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ConnectExternalWallet;
