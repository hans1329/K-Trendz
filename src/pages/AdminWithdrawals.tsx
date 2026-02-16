import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, RefreshCw, Loader2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import V2Layout from "@/components/home/V2Layout";

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

const PAGE_SIZE = 50;

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchData = async (currentPage: number) => {
    try {
      setRefreshing(true);

      // 전체 건수 조회
      const { count } = await supabase
        .from('usdc_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_type', 'withdrawal');

      setTotalCount(count || 0);

      // 페이지네이션된 출금 내역 조회
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: withdrawalData, error } = await supabase
        .from('usdc_transactions')
        .select('*')
        .eq('transaction_type', 'withdrawal')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // 유저 프로필 조회
      const userIds = [...new Set((withdrawalData || []).map(w => w.user_id))];
      let profileMap: Record<string, { username: string | null; display_name: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', userIds);
        
        profiles?.forEach(p => {
          profileMap[p.id] = { username: p.username, display_name: p.display_name };
        });
      }

      const formatted: WithdrawalRecord[] = (withdrawalData || []).map(w => ({
        ...w,
        username: profileMap[w.user_id]?.username || null,
        display_name: profileMap[w.user_id]?.display_name || null,
      }));

      setWithdrawals(formatted);
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [page]);

  const handleRefresh = () => {
    fetchData(page);
  };

  // 상태 배지 색상
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

  const getBaseScanLink = (txHash: string) => `https://basescan.org/tx/${txHash}`;

  if (loading) {
    return (
      <V2Layout pcHeaderTitle="All Withdrawals" showBackButton>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </V2Layout>
    );
  }

  return (
    <V2Layout pcHeaderTitle="All Withdrawals" showBackButton>
      <div className="p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  All Withdrawals
                </CardTitle>
                <CardDescription>
                  {totalCount} total withdrawal records
                </CardDescription>
              </div>
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
            </div>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No withdrawal records found.</p>
            ) : (
              <>
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

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages || 1}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0 || refreshing}
                      className="rounded-full"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1 || refreshing}
                      className="rounded-full"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </V2Layout>
  );
};

export default AdminWithdrawals;
