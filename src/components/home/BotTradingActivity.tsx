import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bot, TrendingUp, TrendingDown, Activity, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Transaction {
  type: "buy" | "sell";
  tokenId: string;
  artistName: string;
  buyer?: string;
  seller?: string;
  amount: number;
  totalCost?: number;
  refund?: number;
  txHash: string;
  timestamp: number;
}

interface Stats {
  totalBuys: number;
  totalSells: number;
  totalVolume: number;
  mostTradedToken: { tokenId: string; artistName: string; count: number } | null;
  uniqueTraders: number;
}

interface BotTradingActivityProps {
  className?: string;
}

const BotTradingActivity = ({ className = "" }: BotTradingActivityProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-bot-trading-activity", {
          body: { limit: 10 },
        });

        if (error) throw error;
        if (data?.success) {
          setTransactions(data.transactions);
          setStats(data.stats);
        }
      } catch (err: any) {
        console.error("Failed to fetch bot activity:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, []);

  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold">Bot Trading Activity</span>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">Bot Trading Activity</span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No trading activity available
        </p>
      </Card>
    );
  }

  const hasActivity = transactions.length > 0 || stats.totalBuys > 0 || stats.totalSells > 0;

  return (
    <Card className={`p-4 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold">Bot Trading (7d)</span>
        </div>
        <Badge variant="outline" className="text-xs">
          <Zap className="w-3 h-3 mr-1" />
          Live
        </Badge>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-muted rounded-lg p-3 text-center">
          <span className="font-bold text-lg text-foreground">{stats.totalBuys}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Buys</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <span className="font-bold text-lg text-foreground">{stats.totalSells}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Sells</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <span className="font-bold text-lg text-foreground">${stats.totalVolume.toFixed(0)}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Volume</p>
        </div>
      </div>

      {/* 가장 많이 거래된 토큰 */}
      {stats.mostTradedToken && (
        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Most Traded</p>
              <p className="font-semibold text-sm">{stats.mostTradedToken.artistName}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {stats.mostTradedToken.count} trades
            </Badge>
          </div>
        </div>
      )}

      {/* 최근 거래 내역 */}
      {hasActivity && transactions.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-2">Recent Transactions</p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {transactions.map((tx, i) => (
              <div
                key={`${tx.txHash}-${i}`}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
              <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      tx.type === "buy"
                        ? "bg-accent text-accent-foreground"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {tx.type === "buy" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{tx.artistName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(tx.timestamp * 1000, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-semibold ${
                      tx.type === "buy" ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {tx.type === "buy" ? "+" : "-"}
                    {tx.amount} LS
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ${(tx.totalCost || tx.refund || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasActivity && (
        <div className="text-center py-4">
          <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No bot activity in the last 24h</p>
        </div>
      )}

      {/* 트레이더 수 */}
      {stats.uniqueTraders > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{stats.uniqueTraders} unique traders</span>
        </div>
      )}
    </Card>
  );
};

export default BotTradingActivity;
