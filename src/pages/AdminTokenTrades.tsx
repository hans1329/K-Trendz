import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import V2Layout from "@/components/home/V2Layout";

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

const PAGE_SIZE = 50;

const AdminTokenTrades = () => {
  const [trades, setTrades] = useState<TokenTradeRecord[]>([]);
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
        .from('fanz_transactions')
        .select('id', { count: 'exact', head: true });

      setTotalCount(count || 0);

      // 페이지네이션된 거래 내역 조회
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: tradeData, error } = await supabase
        .from('fanz_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // 유저 프로필 조회
      const userIds = [...new Set((tradeData || []).map(t => t.user_id))];
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

      const formatted: TokenTradeRecord[] = (tradeData || []).map(t => ({
        ...t,
        username: profileMap[t.user_id]?.username || null,
        display_name: profileMap[t.user_id]?.display_name || null,
        token_name: tokenMap[t.fanz_token_id] || null,
      }));

      setTrades(formatted);
    } catch (error) {
      console.error('Failed to fetch token trades:', error);
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

  if (loading) {
    return (
      <V2Layout pcHeaderTitle="All Token Trades" showBackButton>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </V2Layout>
    );
  }

  return (
    <V2Layout pcHeaderTitle="All Token Trades" showBackButton>
      <div className="p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  All Token Trades
                </CardTitle>
                <CardDescription>
                  {totalCount} total trade records
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
            {trades.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No trade records found.</p>
            ) : (
              <>
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
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.map((t) => (
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
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ${(Number(t.platform_fee) + Number(t.creator_fee)).toFixed(2)}
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

export default AdminTokenTrades;
