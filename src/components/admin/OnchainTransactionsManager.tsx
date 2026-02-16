import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, RefreshCw, UserCircle, Activity, DollarSign, Loader2, Vote, Coins, Award, Link2 } from "lucide-react";
import { format } from "date-fns";

type TxCategory = "identity" | "activity" | "economic" | "all" | "onchain";

interface OnchainTx {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  contract: string;
  contractName: string;
  eventName: string;
  category: "identity" | "activity" | "economic";
  description: string;
  from?: string;
  to?: string;
  value?: string;
  args: Record<string, any>;
}

interface UnifiedTransaction {
  id: string;
  category: "identity" | "activity" | "economic";
  type: string;
  subType?: string;
  description: string;
  txHash: string | null;
  timestamp: string;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  metadata?: Record<string, any>;
  source: string;
}

export const OnchainTransactionsManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [onchainTransactions, setOnchainTransactions] = useState<OnchainTx[]>([]);
  const [category, setCategory] = useState<TxCategory>("all");
  const [stats, setStats] = useState({
    identity: 0,
    activity: 0,
    economic: 0,
    total: 0,
    onchain: 0,
    gasless: 0,
  });
  const [onchainStats, setOnchainStats] = useState<{
    total: number;
    identity: number;
    activity: number;
    economic: number;
    byContract: { challenge: number; fanzToken: number; ktnzToken: number; vote: number; voteV2: number };
    blockRange: { from: number; to: number };
  } | null>(null);

  // 온체인 직접 조회
  const fetchOnchainTransactions = async () => {
    setOnchainLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-onchain-transactions");
      if (error) throw error;
      
      setOnchainTransactions(data.transactions || []);
      setOnchainStats(data.stats || null);
      toast({ title: "Success", description: `Fetched ${data.transactions?.length || 0} on-chain transactions` });
    } catch (error: any) {
      console.error("Error fetching onchain transactions:", error);
      toast({ title: "Error", description: error.message || "Failed to fetch on-chain transactions", variant: "destructive" });
    } finally {
      setOnchainLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const allTxs: UnifiedTransaction[] = [];
      const userIds = new Set<string>();

      // 1. Identity Tx: 챌린지 참여
      const { data: participations } = await supabase
        .from("challenge_participations")
        .select(`id, created_at, answer, user_id, challenge_id, is_winner, prize_amount, claimed_at, challenges!inner(question, status)`)
        .order("created_at", { ascending: false })
        .limit(100);

      participations?.forEach((p) => {
        userIds.add(p.user_id);
        allTxs.push({
          id: `participation-${p.id}`,
          category: "identity",
          type: "Challenge Prediction",
          subType: "Gasless",
          description: `Predicted "${p.answer}" for "${(p.challenges as any)?.question?.substring(0, 40)}..."`,
          txHash: null,
          timestamp: p.created_at,
          metadata: { challengeId: p.challenge_id, answer: p.answer, isWinner: p.is_winner },
          source: "challenge_participations",
        });
      });

      // 2a. Activity Tx: 스페셜 이벤트 투표
      const { data: specialVotes } = await supabase
        .from("special_votes")
        .select(`id, created_at, vote_count, tx_hash, user_id, event_id, special_vote_events!inner(title, wiki_entry_id)`)
        .order("created_at", { ascending: false })
        .limit(200);

      specialVotes?.forEach((v) => {
        if (v.user_id) userIds.add(v.user_id);
        allTxs.push({
          id: `vote-${v.id}`,
          category: "activity",
          type: "Special Event Vote",
          subType: v.tx_hash ? "Onchain" : "Offchain",
          description: `Voted ${v.vote_count}x for "${(v.special_vote_events as any)?.title}"`,
          txHash: v.tx_hash,
          timestamp: v.created_at,
          metadata: { eventId: v.event_id, voteCount: v.vote_count },
          source: "special_votes",
        });
      });

      // 2b. Activity Tx: 위키 엔트리 투표
      const { data: wikiVotes } = await supabase
        .from("wiki_entry_votes")
        .select(`id, created_at, vote_type, user_id, wiki_entry_id, wiki_entries!inner(title)`)
        .order("created_at", { ascending: false })
        .limit(100);

      wikiVotes?.forEach((v) => {
        userIds.add(v.user_id);
        allTxs.push({
          id: `wiki-vote-${v.id}`,
          category: "activity",
          type: "Wiki Entry Vote",
          subType: "Offchain",
          description: `${v.vote_type === 'up' ? '👍' : '👎'} "${(v.wiki_entries as any)?.title}"`,
          txHash: null,
          timestamp: v.created_at,
          metadata: { wikiEntryId: v.wiki_entry_id, voteType: v.vote_type },
          source: "wiki_entry_votes",
        });
      });

      // 3a. Economic Tx: Fanz 토큰 거래
      const { data: fanzTxs } = await supabase
        .from("fanz_transactions")
        .select(`id, created_at, amount, transaction_type, tx_hash, user_id, total_value, payment_token, fanz_tokens!inner(token_id, wiki_entry_id)`)
        .order("created_at", { ascending: false })
        .limit(200);

      fanzTxs?.forEach((t) => {
        userIds.add(t.user_id);
        const tokenName = (t.fanz_tokens as any)?.token_id || "Unknown";
        allTxs.push({
          id: `fanz-${t.id}`,
          category: "economic",
          type: t.transaction_type === "buy" ? "Lightstick Purchase" : "Lightstick Sale",
          subType: t.tx_hash ? "Onchain" : "Offchain",
          description: `${t.transaction_type === "buy" ? "Bought" : "Sold"} ${t.amount} ${tokenName} ($${Number(t.total_value).toFixed(2)})`,
          txHash: t.tx_hash,
          timestamp: t.created_at,
          metadata: { amount: t.amount, totalValue: t.total_value, tokenId: tokenName },
          source: "fanz_transactions",
        });
      });

      // 3b. Economic Tx: 챌린지 상금 클레임
      participations?.filter(p => p.claimed_at && p.is_winner).forEach((p) => {
        allTxs.push({
          id: `claim-${p.id}`,
          category: "economic",
          type: "Prize Claim",
          subType: "Gasless",
          description: `Claimed $${Number(p.prize_amount).toFixed(2)} USDC prize`,
          txHash: null,
          timestamp: p.claimed_at!,
          metadata: { challengeId: p.challenge_id, prizeAmount: p.prize_amount },
          source: "challenge_participations",
        });
      });

      // 3c. Economic Tx: 베스팅 스케줄
      const { data: vestingSchedules } = await supabase
        .from("vesting_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      vestingSchedules?.forEach((v) => {
        if (v.beneficiary_user_id) userIds.add(v.beneficiary_user_id);
        allTxs.push({
          id: `vesting-${v.id}`,
          category: "economic",
          type: "KTNZ Vesting",
          subType: v.tx_hash ? "Onchain" : "Pending",
          description: `Vesting ${v.total_amount} KTNZ over ${v.vesting_duration_days} days`,
          txHash: v.tx_hash,
          timestamp: v.created_at,
          metadata: { totalAmount: v.total_amount, status: v.status },
          source: "vesting_schedules",
        });
      });

      // 사용자 정보 조회
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // 사용자 정보 매핑
      allTxs.forEach((tx) => {
        const userId = participations?.find(p => `participation-${p.id}` === tx.id || `claim-${p.id}` === tx.id)?.user_id
          || specialVotes?.find(v => `vote-${v.id}` === tx.id)?.user_id
          || wikiVotes?.find(v => `wiki-vote-${v.id}` === tx.id)?.user_id
          || fanzTxs?.find(t => `fanz-${t.id}` === tx.id)?.user_id
          || vestingSchedules?.find(v => `vesting-${v.id}` === tx.id)?.beneficiary_user_id;
        if (userId) tx.user = profileMap.get(userId);
      });

      allTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setTransactions(allTxs);
      setStats({
        identity: allTxs.filter((t) => t.category === "identity").length,
        activity: allTxs.filter((t) => t.category === "activity").length,
        economic: allTxs.filter((t) => t.category === "economic").length,
        total: allTxs.length,
        onchain: allTxs.filter(t => t.txHash).length,
        gasless: allTxs.filter(t => !t.txHash).length,
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchTransactions(); 
    fetchOnchainTransactions(); // 자동으로 온체인 데이터도 로드
  }, []);

  const filteredTransactions = category === "all" 
    ? transactions 
    : category === "onchain" 
      ? transactions.filter((t) => t.txHash !== null)
      : transactions.filter((t) => t.category === category);

  const getCategoryBadge = (cat: "identity" | "activity" | "economic") => {
    switch (cat) {
      case "identity": return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><UserCircle className="w-3 h-3 mr-1" />Identity</Badge>;
      case "activity": return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><Activity className="w-3 h-3 mr-1" />Activity</Badge>;
      case "economic": return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30"><DollarSign className="w-3 h-3 mr-1" />Economic</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type.includes("Vote")) return <Vote className="w-3 h-3" />;
    if (type.includes("Prediction")) return <UserCircle className="w-3 h-3" />;
    if (type.includes("Lightstick")) return <Coins className="w-3 h-3" />;
    if (type.includes("Prize") || type.includes("Claim")) return <Award className="w-3 h-3" />;
    if (type.includes("Vesting")) return <DollarSign className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  const shortenTxHash = (hash: string | null) => hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : null;
  const getBasescanUrl = (hash: string) => `https://basescan.org/tx/${hash}`;

  return (
    <div className="space-y-6">
      {/* 온체인 통계 카드 (실제 온체인 데이터 기반) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{onchainStats?.identity ?? (onchainLoading ? "..." : 0)}</p>
                <p className="text-xs text-muted-foreground">Identity Tx</p>
                <p className="text-xs text-blue-500/70">Challenge: {onchainStats?.byContract.challenge ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{onchainStats?.activity ?? (onchainLoading ? "..." : 0)}</p>
                <p className="text-xs text-muted-foreground">Activity Tx</p>
                <p className="text-xs text-green-500/70">Vote: {(onchainStats?.byContract.vote ?? 0) + (onchainStats?.byContract.voteV2 ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{onchainStats?.economic ?? (onchainLoading ? "..." : 0)}</p>
                <p className="text-xs text-muted-foreground">Economic Tx</p>
                <p className="text-xs text-orange-500/70">Fanz: {onchainStats?.byContract.fanzToken ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/50">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{onchainStats?.total ?? (onchainLoading ? "..." : 0)}</p>
            <p className="text-xs text-muted-foreground">Total Onchain</p>
            <p className="text-xs text-primary/70">BaseScan + Cache</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{onchainStats?.byContract.ktnzToken ?? (onchainLoading ? "..." : 0)}</p>
            <p className="text-xs text-muted-foreground">KTNZ Transfers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.gasless}</p>
            <p className="text-xs text-muted-foreground">Gasless (DB)</p>
          </CardContent>
        </Card>
      </div>

      {/* 카테고리 설명 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transaction Categories</CardTitle>
          <CardDescription>Unified on-chain transaction structure for transparency and external auditing (e.g., Base Foundation)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-blue-600">Identity Tx</span>
              </div>
              <p className="text-muted-foreground text-xs mb-2">Proof of human engagement</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Challenge participation (prediction hash)</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-green-600">Activity Tx</span>
              </div>
              <p className="text-muted-foreground text-xs mb-2">User loyalty metrics</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Special event voting (on-chain)</li>
                <li>• Wiki entry voting (off-chain)</li>
                <li>• Daily KTNZ rewards</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-orange-600">Economic Tx</span>
              </div>
              <p className="text-muted-foreground text-xs mb-2">Value transfer</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Lightstick (Fanz Token) purchase/sale</li>
                <li>• Challenge prize claims</li>
                <li>• KTNZ vesting</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 온체인 직접 조회 섹션 */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                On-Chain Direct Query (RPC)
              </CardTitle>
              <CardDescription>
                Directly fetches contract events from Base network via RPC
              </CardDescription>
            </div>
            <Button 
              onClick={fetchOnchainTransactions} 
              disabled={onchainLoading}
              className="gap-2"
            >
              {onchainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Fetch from Chain
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {onchainStats && (
            <div className="mb-4 p-4 rounded-lg bg-muted/50 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total On-Chain</p>
                <p className="text-2xl font-bold text-primary">{onchainStats.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Challenge</p>
                <p className="text-xl font-semibold">{onchainStats.byContract.challenge}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fanz Token</p>
                <p className="text-xl font-semibold">{onchainStats.byContract.fanzToken}</p>
              </div>
              <div>
                <p className="text-muted-foreground">KTNZ Token</p>
                <p className="text-xl font-semibold">{onchainStats.byContract.ktnzToken}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vote (V1+V2)</p>
                <p className="text-xl font-semibold text-green-600">{(onchainStats.byContract.vote || 0) + (onchainStats.byContract.voteV2 || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">V1 / V2</p>
                <p className="text-sm font-medium">{onchainStats.byContract.vote || 0} / {onchainStats.byContract.voteV2 || 0}</p>
              </div>
            </div>
          )}

          {onchainLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Querying blockchain...</span>
            </div>
          ) : onchainTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Click "Fetch from Chain" to query on-chain transactions
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="hidden lg:table-cell">Description</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onchainTransactions.slice(0, 100).map((tx, idx) => (
                    <TableRow key={`${tx.txHash}-${idx}`}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {tx.contractName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(tx.category)}
                          <span className="font-medium text-sm">{tx.eventName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        #{tx.blockNumber.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={getBasescanUrl(tx.txHash)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                        >
                          {shortenTxHash(tx.txHash)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {tx.timestamp > 0 ? format(new Date(tx.timestamp * 1000), "MMM d, HH:mm") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DB 기반 트랜잭션 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>DB Transactions (Mixed)</CardTitle>
            <div className="flex items-center gap-2">
              <Tabs value={category} onValueChange={(v) => setCategory(v as TxCategory)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2 h-7">All ({stats.total})</TabsTrigger>
                  <TabsTrigger value="onchain" className="text-xs px-2 h-7 text-primary">🔗 Onchain ({stats.onchain})</TabsTrigger>
                  <TabsTrigger value="identity" className="text-xs px-2 h-7">Identity</TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs px-2 h-7">Activity</TabsTrigger>
                  <TabsTrigger value="economic" className="text-xs px-2 h-7">Economic</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Description</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.slice(0, 100).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{getCategoryBadge(tx.category)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(tx.type)}
                          <span className="font-medium text-sm">{tx.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        {tx.user ? <span className="text-sm">@{tx.user.username}</span> : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>
                      <TableCell>
                        {tx.txHash ? (
                          <a href={getBasescanUrl(tx.txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono">
                            {shortenTxHash(tx.txHash)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{tx.subType || "Gasless"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(tx.timestamp), "MMM d, HH:mm")}
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
