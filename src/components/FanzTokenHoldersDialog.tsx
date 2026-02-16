import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Copy, Sparkles, Users, ArrowRightLeft, Trophy, X } from "lucide-react";
import { toast } from "sonner";

interface FanzTokenHoldersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  tokenStringId: string;
  entryTitle: string;
}

const FANZTOKEN_CONTRACT_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7"; // V5 컨트랙트

const FanzTokenHoldersDialog = ({
  open,
  onOpenChange,
  tokenId,
  tokenStringId,
  entryTitle
}: FanzTokenHoldersDialogProps) => {
  // 홀더 리스트 조회
  const { data: holders, isLoading: holdersLoading } = useQuery({
    queryKey: ['fanz-token-holders', tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_balances')
        .select(`
          balance,
          user_id,
          profiles!fanz_balances_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('fanz_token_id', tokenId)
        .gt('balance', 0)
        .order('balance', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!tokenId
  });

  // 거래 히스토리 조회
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['fanz-token-transactions', tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_transactions')
        .select(`
          *,
          profiles!fanz_transactions_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('fanz_token_id', tokenId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!tokenId
  });

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // tokenStringId는 이미 uint256 string이므로 그대로 사용
  const tokenIdUint = tokenStringId || null;
  const fullTokenUrl = tokenIdUint 
    ? `https://basescan.org/token/${FANZTOKEN_CONTRACT_ADDRESS}?a=${tokenIdUint}`
    : null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getRankEmoji = (index: number) => {
    if (index === 0) return "👑";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0" hideCloseButton>
        {/* 캐주얼 그라데이션 헤더 */}
        <div className="bg-gradient-to-r from-primary/90 via-orange-500 to-amber-500 p-5 text-white rounded-t-lg relative">
          {/* 커스텀 닫기 버튼 */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 pr-10">
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                🪄 Lightstick Info
              </h2>
              <p className="text-white/90 text-sm truncate">{entryTitle}</p>
            </div>
          </div>
          
          {/* 컨트랙트 정보 */}
          <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 w-fit max-w-full">
            <span className="text-xs text-white/80 flex-shrink-0">On Base</span>
            <span className="text-xs font-mono truncate">{shortenAddress(FANZTOKEN_CONTRACT_ADDRESS)}</span>
            <button
              onClick={() => copyToClipboard(FANZTOKEN_CONTRACT_ADDRESS, 'Contract address')}
              className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
            >
              <Copy className="w-3 h-3" />
            </button>
            <a
              href={`https://basescan.org/address/${FANZTOKEN_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col min-w-0">
          <Tabs defaultValue="holders" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="holders" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Users className="w-4 h-4" />
                Holders
                {holders && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{holders.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-white">
                <ArrowRightLeft className="w-4 h-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="holders" className="flex-1 overflow-y-auto overflow-x-hidden mt-4 min-w-0">
              {holdersLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl animate-pulse">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-5 w-12" />
                    </div>
                  ))}
                </div>
              ) : holders && holders.length > 0 ? (
                <div className="space-y-2">
                  {holders.map((holder, index) => (
                    <div 
                      key={holder.user_id}
                      className={`w-full min-w-0 flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01] ${
                        index === 0 
                          ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800' 
                          : index === 1 
                            ? 'bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 dark:from-slate-900/50 dark:to-gray-900/50 dark:border-slate-700'
                            : index === 2
                              ? 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-800'
                              : 'bg-muted/30 border border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-lg w-8 text-center">
                        {getRankEmoji(index) || <span className="text-sm text-muted-foreground">#{index + 1}</span>}
                      </div>
                      <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
                        <AvatarImage src={holder.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-orange-200">
                          {holder.profiles?.display_name?.[0] || holder.profiles?.username?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-1">
                          {holder.profiles?.display_name || holder.profiles?.username || 'Unknown'}
                          {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{holder.profiles?.username || 'unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary text-lg">
                          {holder.balance}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          🪄 sticks
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🪄</div>
                  <p className="text-muted-foreground">No holders yet</p>
                  <p className="text-sm text-muted-foreground/70">Be the first to support!</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="flex-1 overflow-y-auto overflow-x-hidden mt-4 min-w-0">
              {transactionsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl animate-pulse">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-all"
                    >
                      <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
                        <AvatarImage src={tx.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-orange-200">
                          {tx.profiles?.display_name?.[0] || tx.profiles?.username?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {tx.profiles?.display_name || tx.profiles?.username || 'Unknown'}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            tx.transaction_type === 'buy' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {tx.transaction_type === 'buy' ? '🎉 Bought' : 'Sold'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${tx.transaction_type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.transaction_type === 'buy' ? '+' : '-'}{tx.amount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${Number(tx.total_value).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-muted-foreground">No activity yet</p>
                  <p className="text-sm text-muted-foreground/70">Transactions will appear here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FanzTokenHoldersDialog;
