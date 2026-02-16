import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2, ExternalLink, Wallet, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface UnclaimedPrize {
  id: string;
  prize_amount: number;
  answer: string;
  created_at: string;
  challenge_id: string;
  challenge: {
    question: string;
    image_url: string | null;
  };
}

interface ExternalPrizeClaimProps {
  externalWalletAddress: string | null;
  onClaimSuccess?: () => void;
}

export const ExternalPrizeClaim = ({ externalWalletAddress, onClaimSuccess }: ExternalPrizeClaimProps) => {
  const [unclaimedPrizes, setUnclaimedPrizes] = useState<UnclaimedPrize[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  // 미청구 상금 조회
  const fetchUnclaimedPrizes = async () => {
    if (!externalWalletAddress) return;

    setLoading(true);
    try {
      // external_challenge_participations에서 wallet_address로 직접 join 조회
      // (타입 추론이 과도하게 깊어지는 이슈가 있어 any로 우회)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('external_challenge_participations')
        .select(`
          id,
          prize_amount,
          answer,
          created_at,
          challenge_id,
          external_wallet_users!inner (
            id,
            wallet_address
          ),
          challenges!inner (
            question,
            image_url
          )
        `)
        .eq('external_wallet_users.wallet_address', externalWalletAddress.toLowerCase())
        .eq('is_winner', true)
        .is('claimed_at', null)
        .gt('prize_amount', 0);

      if (error) throw error;

      const formatted: UnclaimedPrize[] = (data || []).map((item: any) => ({
        id: item.id,
        prize_amount: item.prize_amount,
        answer: item.answer,
        created_at: item.created_at,
        challenge_id: item.challenge_id,
        challenge: {
          question: item.challenges.question,
          image_url: item.challenges.image_url,
        },
      }));

      setUnclaimedPrizes(formatted);
    } catch (error) {
      console.error('Error fetching unclaimed prizes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnclaimedPrizes();
  }, [externalWalletAddress]);

  // 클레임 처리 (서명 요청)
  const handleClaim = async (prize: UnclaimedPrize) => {
    if (!externalWalletAddress || !window.ethereum) {
      toast.error('Please connect your wallet first');
      return;
    }

    setClaiming(prize.id);
    try {
      // 1. 서명 메시지 생성
      const message = `Claim prize for K-Trendz Challenge\n\nChallenge: ${prize.challenge_id}\nAmount: $${prize.prize_amount} USDC\nWallet: ${externalWalletAddress}\nTimestamp: ${Date.now()}`;

      // 2. 지갑에서 서명 요청
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const connectedAddress = accounts[0];

      if (connectedAddress.toLowerCase() !== externalWalletAddress.toLowerCase()) {
        toast.error('Connected wallet does not match. Please switch to the correct wallet.');
        return;
      }

      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, connectedAddress],
      });

      // 3. Edge Function 호출
      const { data, error } = await supabase.functions.invoke('claim-external-prize', {
        body: {
          participationId: prize.id,
          walletAddress: externalWalletAddress,
          message,
          signature,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Successfully claimed $${prize.prize_amount} USDC!`, {
          description: 'The prize has been sent to your wallet.',
        });
        
        // 목록에서 제거
        setUnclaimedPrizes(prev => prev.filter(p => p.id !== prize.id));
        onClaimSuccess?.();
      } else {
        throw new Error(data?.error || 'Failed to claim prize');
      }
    } catch (error: any) {
      console.error('Claim error:', error);
      
      if (error.code === 4001) {
        toast.error('Signature rejected');
      } else {
        toast.error(error.message || 'Failed to claim prize');
      }
    } finally {
      setClaiming(null);
    }
  };

  // YouTube 썸네일 추출
  const getYoutubeThumbnail = (url: string | null): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
      }
    }
    return null;
  };

  if (!externalWalletAddress) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="py-6 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" />
          <p className="text-sm text-muted-foreground mt-2">Checking for unclaimed prizes...</p>
        </CardContent>
      </Card>
    );
  }

  if (unclaimedPrizes.length === 0) {
    return null;
  }

  const totalUnclaimed = unclaimedPrizes.reduce((sum, p) => sum + p.prize_amount, 0);

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-lg">Unclaimed Prizes</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            ${totalUnclaimed.toFixed(2)} USDC
          </Badge>
        </div>
        <CardDescription className="text-sm">
          You have {unclaimedPrizes.length} prize{unclaimedPrizes.length > 1 ? 's' : ''} waiting to be claimed via your connected wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 연결된 지갑 표시 */}
        <div className="flex items-center gap-2 p-2 bg-background/60 rounded-lg border">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground truncate flex-1">
            {externalWalletAddress}
          </span>
          <CheckCircle className="w-4 h-4 text-green-500" />
        </div>

        {/* 미청구 상금 목록 */}
        <div className="space-y-2">
          {unclaimedPrizes.map((prize) => {
            const thumbnailUrl = getYoutubeThumbnail(prize.challenge.image_url) || prize.challenge.image_url;
            
            return (
              <div
                key={prize.id}
                className="flex items-center gap-3 p-3 bg-background rounded-lg border"
              >
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt="Challenge"
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">
                    {prize.challenge.question}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(prize.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-green-600">
                    ${prize.prize_amount.toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleClaim(prize)}
                    disabled={claiming === prize.id}
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    {claiming === prize.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Claim'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 안내 문구 */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Sign with your wallet to verify ownership and receive USDC directly
        </p>
      </CardContent>
    </Card>
  );
};

export default ExternalPrizeClaim;
