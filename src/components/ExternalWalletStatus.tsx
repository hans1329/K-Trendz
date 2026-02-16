import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Loader2, Trophy, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { format } from 'date-fns';
import WalletSignIn from '@/components/WalletSignIn';

interface ExternalParticipation {
  id: string;
  challenge_id: string;
  answer: string;
  is_winner: boolean | null;
  prize_amount: number | null;
  claimed_at: string | null;
  created_at: string;
  challenge: {
    question: string;
    correct_answer: string;
    status: string;
    selected_at: string | null;
    total_prize_usdc: number;
  } | null;
}

const ExternalWalletStatus = () => {
  const { user, loading: authLoading } = useAuth();
  const { connectedAddress, isConnecting, connectWallet, disconnectWallet } = useWalletAuth({ redirectTo: '/challenges' });
  
  const [participations, setParticipations] = useState<ExternalParticipation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [_hasChecked, setHasChecked] = useState(false);
  const [isAlreadyLinked, setIsAlreadyLinked] = useState(false);

  // 이미 로그인한 사용자에게는 이 컴포넌트를 보여줄 필요 없음
  if (authLoading) return null;
  if (user) return null;

  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      if (address) {
        await fetchParticipations(address);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
    }
  };

  const fetchParticipations = async (walletAddress: string) => {
    setIsLoading(true);
    try {
      // 참여 내역을 external_wallet_users의 wallet_address로 직접 join 조회
      // (타입 추론이 과도하게 깊어지는 이슈가 있어 any로 우회)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entries, error: entriesError } = await (supabase as any)
        .from('external_challenge_participations')
        .select(`
          id,
          challenge_id,
          answer,
          is_winner,
          prize_amount,
          claimed_at,
          created_at,
          external_wallet_users!inner (
            id,
            wallet_address
          ),
          challenge:challenges(
            question,
            correct_answer,
            status,
            selected_at,
            total_prize_usdc
          )
        `)
        .eq('external_wallet_users.wallet_address', walletAddress.toLowerCase())
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;

      if (!entries || entries.length === 0) {
        setParticipations([]);
        setHasChecked(true);
        setIsAlreadyLinked(false);
        return;
      }

      // 현재 로그인한 유저의 wallet_addresses에서 연결 여부 확인
      let linkedToCurrentUser = false;
      if (user) {
        const { data: userWallets } = await supabase
          .from('wallet_addresses')
          .select('wallet_address')
          .eq('user_id', user.id);
        linkedToCurrentUser = userWallets?.some(w => 
          w.wallet_address.toLowerCase() === walletAddress.toLowerCase()
        ) ?? false;
      }
      setIsAlreadyLinked(linkedToCurrentUser);

      // 결과를 ExternalParticipation 형태로 변환
      const formattedEntries: ExternalParticipation[] = entries.map((e: any) => ({
        id: e.id,
        challenge_id: e.challenge_id,
        answer: e.answer,
        is_winner: e.is_winner,
        prize_amount: e.prize_amount,
        claimed_at: e.claimed_at,
        created_at: e.created_at,
        challenge: e.challenge,
      }));

      setParticipations(formattedEntries);
      setHasChecked(true);
    } catch (error: any) {
      console.error('Failed to fetch participations:', error);
      toast.error('Failed to fetch your challenge history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setParticipations([]);
    setHasChecked(false);
    setIsAlreadyLinked(false);
  };

  const getStatusBadge = (participation: ExternalParticipation) => {
    const challenge = participation.challenge;
    
    if (!challenge) {
      return <Badge variant="outline" className="text-slate-400">Unknown</Badge>;
    }

    // 결과 발표 전
    if (!challenge.selected_at) {
      return (
        <Badge variant="outline" className="text-amber-400 border-amber-400/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    // 당첨
    if (participation.is_winner) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
          <Trophy className="h-3 w-3 mr-1" />
          Winner! ${participation.prize_amount || 0}
        </Badge>
      );
    }

    // 낙첨
    return (
      <Badge variant="outline" className="text-slate-400 border-slate-500/30">
        <XCircle className="h-3 w-3 mr-1" />
        Not Selected
      </Badge>
    );
  };

  // 연결 전 상태
  if (!connectedAddress) {
    return (
      <Card className="bg-slate-800/50 border-amber-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-amber-300">
            <Wallet className="h-5 w-5" />
            Joined via Farcaster?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            Connect your wallet to check your Farcaster Frame challenge entries and prize status.
          </p>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet to Check Status
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 연결됨 + 로딩
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-amber-500/20">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span className="ml-2 text-slate-300">Checking your entries...</span>
        </CardContent>
      </Card>
    );
  }

  // 연결됨 + 결과
  return (
    <Card className="bg-slate-800/50 border-amber-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-amber-300">
            <Wallet className="h-5 w-5" />
            Farcaster Entries
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="h-8 px-2 text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
        <p className="text-xs text-slate-500 truncate">
          {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {participations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm">No challenge entries found for this wallet.</p>
              <p className="text-slate-500 text-xs mt-2">
                Participate via Farcaster Frames to see your entries here!
              </p>
            </div>
          ) : (
            <>
              {participations.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-slate-200 line-clamp-2 flex-1">
                      {p.challenge?.question || 'Challenge'}
                    </p>
                    {getStatusBadge(p)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Your answer: <span className="text-amber-300">{p.answer}</span>
                    </span>
                    <span>{format(new Date(p.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {p.is_winner && p.prize_amount && !p.claimed_at && (
                    <div className="mt-2 pt-2 border-t border-slate-600/50">
                      <div className="flex items-center gap-2 text-green-400 text-xs">
                        <CheckCircle className="h-4 w-4" />
                        <span>Prize of ${p.prize_amount} USDC will be sent to your wallet!</span>
                      </div>
                    </div>
                  )}
                  {p.is_winner && p.claimed_at && (
                    <div className="mt-2 pt-2 border-t border-slate-600/50">
                      <div className="flex items-center gap-2 text-green-400 text-xs">
                        <CheckCircle className="h-4 w-4" />
                        <span>Prize claimed on {format(new Date(p.claimed_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* K-Trendz 계정 로그인/연결 - WalletSignIn 컴포넌트 재사용 */}
          {!user && (
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20">
              <p className="text-xs text-primary mb-2 font-medium">
                {isAlreadyLinked
                  ? '✅ This wallet is linked. Sign in to continue:'
                  : '🔗 Link your wallet to K-Trendz for full access:'}
              </p>

              {!isAlreadyLinked && (
                <ul className="text-xs text-slate-400 space-y-1 ml-4 mb-3">
                  <li>• Participate in challenges on the website</li>
                  <li>• Manage prizes in your account</li>
                  <li>• Unified challenge history</li>
                </ul>
              )}

              {/* 공통 WalletSignIn 컴포넌트 사용 (compact 모드) */}
              <WalletSignIn redirectTo="/challenges" compact />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExternalWalletStatus;
