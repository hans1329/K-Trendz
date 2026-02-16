import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, RefreshCw, Loader2, ExternalLink, Users, TrendingUp, ShoppingCart, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminWalletBalance } from "./AdminWalletBalance";

// 출금 내역 타입
interface WithdrawalRecord {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  status: string;
  tx_hash: string | null;
  reference_id: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
}

// 응원봉 거래 내역 타입
interface TokenTradeRecord {
  id: string;
  user_id: string;
  fanz_token_id: string;
  transaction_type: string;
  amount: number;
  price_per_token: number;
  total_value: number;
  platform_fee: number;
  creator_fee: number;
  created_at: string;
  username: string | null;
  display_name: string | null;
  token_name: string | null;
}

// 유저 활동 요약 타입
interface ActivitySummary {
  totalWithdrawals: number;
  totalWithdrawalAmount: number;
  totalDeposits: number;
  totalDepositAmount: number;
  recentSignups: number;
  recentTransactions: number;
}

export const AdminUserActivity = () => {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [tokenTrades, setTokenTrades] = useState<TokenTradeRecord[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalWithdrawals: 0,
    totalWithdrawalAmount: 0,
    totalDeposits: 0,
    totalDepositAmount: 0,
    recentSignups: 0,
    recentTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // 출금 내역 조회 (최근 10건)
      const { data: withdrawalData, error: wError } = await supabase
        .from('usdc_transactions')
        .select('*')
        .eq('transaction_type', 'withdrawal')
        .order('created_at', { ascending: false })
        .limit(10);

      if (wError) throw wError;

      // 응원봉 거래 내역 조회 (최근 10건)
      const { data: tradeData, error: tError } = await supabase
        .from('fanz_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (tError) throw tError;

      // 모든 유저 ID 수집
      const allUserIds = [
        ...new Set([
          ...(withdrawalData || []).map(w => w.user_id),
          ...(tradeData || []).map(t => t.user_id),
        ])
      ];

      let profileMap: Record<string, { username: string | null; display_name: string | null }> = {};
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', allUserIds);
        
        profiles?.forEach(p => {
          profileMap[p.id] = { username: p.username, display_name: p.display_name };
        });
      }

      // 출금 내역 포맷
      const formattedWithdrawals: WithdrawalRecord[] = (withdrawalData || []).map(w => ({
        ...w,
        username: profileMap[w.user_id]?.username || null,
        display_name: profileMap[w.user_id]?.display_name || null,
      }));
      setWithdrawals(formattedWithdrawals);

      // 토큰 이름 조회
      const tokenIds = [...new Set((tradeData || []).map(t => t.fanz_token_id))];
      let tokenMap: Record<string, string> = {};

      if (tokenIds.length > 0) {
        const { data: tokens } = await supabase
          .from('fanz_tokens')
          .select('id, wiki_entry_id')
          .in('id', tokenIds);

        const wikiIds = tokens?.map(t => t.wiki_entry_id).filter(Boolean) as string[] || [];
        let wikiMap: Record<string, string> = {};

        if (wikiIds.length > 0) {
          const { data: wikiEntries } = await supabase
            .from('wiki_entries')
            .select('id, title')
            .in('id', wikiIds);

          wikiEntries?.forEach(w => {
            wikiMap[w.id] = w.title;
          });
        }

        tokens?.forEach(t => {
          tokenMap[t.id] = t.wiki_entry_id ? (wikiMap[t.wiki_entry_id] || 'Unknown') : 'Unknown';
        });
      }

      // 거래 내역 포맷
      const formattedTrades: TokenTradeRecord[] = (tradeData || []).map(t => ({
        ...t,
        username: profileMap[t.user_id]?.username || null,
        display_name: profileMap[t.user_id]?.display_name || null,
        token_name: tokenMap[t.fanz_token_id] || null,
      }));
      setTokenTrades(formattedTrades);

      // 요약 통계 조회
      const { data: wSummary } = await supabase
        .from('usdc_transactions')
        .select('amount, fee')
        .eq('transaction_type', 'withdrawal');
      
      const totalWithdrawals = wSummary?.length || 0;
      const totalWithdrawalAmount = wSummary?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

      const { data: dSummary } = await supabase
        .from('usdc_transactions')
        .select('amount')
        .in('transaction_type', ['challenge_prize', 'deposit', 'admin_credit']);
      
      const totalDeposits = dSummary?.length || 0;
      const totalDepositAmount = dSummary?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentSignups } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      const { count: recentTx } = await supabase
        .from('fanz_transactions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      setSummary({
        totalWithdrawals,
        totalWithdrawalAmount,
        totalDeposits,
        totalDepositAmount,
        recentSignups: recentSignups || 0,
        recentTransactions: recentTx || 0,
      });

    } catch (error) {
      console.error('Failed to fetch user activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 출금 상태 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 거래 타입 배지
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'buy':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Buy</Badge>;
      case 'sell':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Sell</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getBaseScanLink = (txHash: string) => `https://basescan.org/tx/${txHash}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 백엔드 스마트 어카운트 잔액 */}
      <AdminWalletBalance />

      {/* 활동 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Signups (7d)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.recentSignups}</div>
            <p className="text-xs text-muted-foreground">New users this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Trades (7d)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.recentTransactions}</div>
            <p className="text-xs text-muted-foreground">Lightstick transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${summary.totalDepositAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{summary.totalDeposits} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${summary.totalWithdrawalAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{summary.totalWithdrawals} transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* 출금 내역 테이블 (최근 10건) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Recent Withdrawals
              </CardTitle>
              <CardDescription>Latest 10 USDC withdrawal requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-full"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/withdrawals')}
                className="rounded-full"
              >
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No withdrawal records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-sm">{w.display_name || w.username || 'Unknown'}</div>
                          {w.username && w.display_name && (
                            <div className="text-xs text-muted-foreground">@{w.username}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Math.abs(Number(w.amount)).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${Number(w.fee).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${(Math.abs(Number(w.amount)) - Number(w.fee)).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(w.status)}</TableCell>
                      <TableCell>
                        {w.tx_hash ? (
                          <a
                            href={getBaseScanLink(w.tx_hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                          >
                            {w.tx_hash.slice(0, 8)}...{w.tx_hash.slice(-6)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(w.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 응원봉 거래 내역 테이블 (최근 10건) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Recent Token Trades
              </CardTitle>
              <CardDescription>Latest 10 lightstick buy/sell transactions</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/token-trades')}
              className="rounded-full"
            >
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokenTrades.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No trade records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenTrades.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-sm">{t.display_name || t.username || 'Unknown'}</div>
                          {t.username && t.display_name && (
                            <div className="text-xs text-muted-foreground">@{t.username}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">
                        {t.token_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{getTypeBadge(t.transaction_type)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {t.amount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(t.price_per_token).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${Number(t.total_value).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
