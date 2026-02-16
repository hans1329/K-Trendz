import { useState, useMemo } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Heart, TrendingUp, History, Coins, Users, Wand2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import BuyFanzTokenDialog from "@/components/BuyFanzTokenDialog";
import FanzTokenHoldersDialog from "@/components/FanzTokenHoldersDialog";
import { useFanzTokenPrice } from "@/hooks/useFanzTokenPrice";
import { useOnchainSupply } from "@/hooks/useOnchainSupply";
import { usePageTranslation } from "@/hooks/usePageTranslation";



interface SupportFundCardProps {
  wikiEntryId: string;
  variant?: 'compact' | 'full';
  showOriginal?: boolean;
}

interface FundTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  user_id: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const SupportFundCard = ({ wikiEntryId, variant = 'compact', showOriginal: externalShowOriginal }: SupportFundCardProps) => {
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [isHoldersDialogOpen, setIsHoldersDialogOpen] = useState(false);

  // wiki entry 정보 조회 (community_name 포함)
  const { data: wikiEntry } = useQuery({
    queryKey: ['wiki-entry-title', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('title, community_name')
        .eq('id', wikiEntryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 60000,
  });

  // 커뮤니티 이름 (선정된 팬덤명이 있으면 사용, 없으면 엔트리 제목)
  const communityDisplayName = wikiEntry?.community_name || wikiEntry?.title;

  // 서포터 수 조회를 위한 토큰 정보
  const { data: fanzToken } = useQuery({
    queryKey: ['fanz-token-for-fund', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select('total_supply, id, token_id, base_price, k_value')
        .eq('wiki_entry_id', wikiEntryId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 30000,
  });

  // 온체인 공급량 조회 (DB 대신 블록체인 직접 조회)
  const { supply: onchainSupply } = useOnchainSupply(fanzToken?.token_id);

  // 토큰 가격 조회 (온체인 전용 - V4 분리 값 포함)
  const { priceInUSD, buyCostUsd, reserveAmount, communityFundAmount, platformFeeAmount } = useFanzTokenPrice(wikiEntryId);

  // 서포터 수 - 펀드 기여 고유 유저 수 조회
  const { data: supporterCount } = useQuery({
    queryKey: ['fund-supporter-count', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entry_fund_transactions')
        .select('user_id')
        .eq('wiki_entry_id', wikiEntryId);
      
      if (error) throw error;
      // 고유 유저 수 계산
      const uniqueUsers = new Set(data?.map(d => d.user_id));
      return uniqueUsers.size;
    },
    enabled: !!wikiEntryId,
    staleTime: 30000,
  });

  // 펀드 잔액 조회
  const { data: fund, isLoading: isLoadingFund } = useQuery({
    queryKey: ['support-fund', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entry_community_funds')
        .select('*')
        .eq('wiki_entry_id', wikiEntryId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 30000,
  });

  // 트랜잭션 히스토리 조회
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['support-fund-transactions', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entry_fund_transactions')
        .select(`
          *,
          profiles:user_id(username, avatar_url)
        `)
        .eq('wiki_entry_id', wikiEntryId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as FundTransaction[];
    },
    enabled: !!wikiEntryId,
    staleTime: 30000,
  });

  const totalFund = fund?.total_fund ?? 0;
  const depositCount = transactions?.filter(t => t.transaction_type === 'deposit' || t.transaction_type === 'contribution').length ?? 0;

  // 번역 세그먼트 구성
  const translationSegments = useMemo(() => {
    const segs: Record<string, string> = {};
    segs['fund_title'] = `${communityDisplayName || 'Community'} Sponsorship Fund`;
    segs['fund_subtitle'] = `for ${wikiEntry?.title || 'this community'}`;
    segs['fund_desc'] = `20% of every LightStick purchase is deposited as a sponsorship fund for ${wikiEntry?.title || 'this artist'}! Holders can vote and decide on fan events, ads & rewards ✨`;
    segs['fund_desc_detail'] = `20% of every LightStick purchase is deposited as a sponsorship fund for ${wikiEntry?.title || 'this artist'}. LightStick holders can vote and decide on how to use it for fan events, ads, and community rewards.`;
    segs['support_btn'] = 'Sponsor with LightStick';
    segs['price_up'] = 'Price goes up as more fans join!';
    segs['resell_guarantee'] = '70% guaranteed when you resell!';
    segs['recent_activity'] = 'Recent Activity';
    segs['no_contributions'] = 'No contributions yet';
    segs['be_first'] = 'Be the first supporter!';
    // 트랜잭션 설명
    transactions?.forEach((tx) => {
      if (tx.description) segs[`tx_${tx.id}`] = tx.description;
    });
    return segs;
  }, [communityDisplayName, wikiEntry?.title, transactions]);

  const {
    t: fundT,
  } = usePageTranslation({
    cacheKey: `fund-${wikiEntryId}`,
    segments: translationSegments,
    enabled: !!wikiEntry,
    overrideShowOriginal: externalShowOriginal,
  });

  if (isLoadingFund) {
    return variant === 'compact' ? (
      <Skeleton className="h-12 w-32" />
    ) : (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 컴팩트 버전 (엔트리 페이지용)
  if (variant === 'compact') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 hover:from-primary/15 hover:via-primary/10 hover:to-primary/15 rounded-full border border-primary/20 transition-all">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              ${Number(totalFund).toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">Support Fund</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Support Fund
            </DialogTitle>
            <DialogDescription className="sr-only">
              View support fund balance and contribution history
            </DialogDescription>
          </DialogHeader>
          <FundDetails 
            totalFund={totalFund} 
            depositCount={depositCount} 
            supporterCount={supporterCount ?? 0}
            transactions={transactions ?? []}
            isLoadingTransactions={isLoadingTransactions}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // 가장 최근 거래 가져오기
  const latestTransaction = transactions?.[0];

  // 풀 버전 (대시보드용) - 캐주얼 스타일
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gradient-to-br dark:from-muted/50 dark:via-background dark:to-muted/30 border border-border/50 p-4 sm:p-6 w-full max-w-3xl mx-auto">
      {/* 배경 장식 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-muted/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-muted/40 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative">
        {/* 최근 거래 티커 - 가로 스크롤 */}
        {latestTransaction && (
          <div className="mb-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 py-3 bg-muted/50 border-b border-border/50 overflow-hidden">
            <div className="flex whitespace-nowrap animate-[marquee_25s_linear_infinite]">
              <span className="flex items-center gap-2 text-xs px-4">
                <span>🎉</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold">@{latestTransaction.profiles?.username || 'Someone'}</span>
                  {' '}purchased a LightStick and contributed{' '}
                  <span className="font-bold text-primary/70">${Math.abs(Number(latestTransaction.amount)).toFixed(2)}</span>!
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs px-4">
                <span>🎉</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold">@{latestTransaction.profiles?.username || 'Someone'}</span>
                  {' '}purchased a LightStick and contributed{' '}
                  <span className="font-bold text-primary/70">${Math.abs(Number(latestTransaction.amount)).toFixed(2)}</span>!
                </span>
              </span>
            </div>
          </div>
        )}

        {/* 헤더 - 이모지와 캐주얼한 타이틀 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 rotate-3 hover:rotate-6 transition-transform">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <h3 className="font-bold text-lg sm:text-xl">{fundT('fund_title')}</h3>
            <p className="text-sm text-muted-foreground">{fundT('fund_subtitle')}</p>
          </div>
        </div>



        {/* 메인 금액 및 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 py-4 sm:py-2 pl-2 sm:pl-4">
          <div className="flex items-baseline gap-2 justify-center sm:justify-start">
            <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              ${Number(totalFund).toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">USD</span>
          </div>
          {fanzToken && (
            <Button 
              className="w-full sm:w-auto px-6 h-10 rounded-full bg-primary hover:bg-primary/90 text-white text-xs"
              onClick={() => setIsBuyDialogOpen(true)}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {fundT('support_btn')}
            </Button>
          )}
          {/* 가격 상승 및 되팔기 안내 문구 */}
          <div className="flex flex-col items-center sm:items-start gap-0.5 mt-1">
            <p className="text-[11px] text-muted-foreground">📈 {fundT('price_up')}</p>
            <p className="text-[11px] text-muted-foreground">💰 {fundT('resell_guarantee')}</p>
          </div>
        </div>

        {/* 스탯 카드들 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <button 
            onClick={() => setIsHoldersDialogOpen(true)}
            className="flex items-center gap-3 p-2 sm:p-3 rounded-xl bg-background/60 backdrop-blur-sm border border-border hover:bg-background/80 transition-colors cursor-pointer text-left"
          >
            <span className="text-base sm:text-lg mx-1">👥</span>
            <div>
              <p className="text-2xl sm:text-2xl font-bold">{supporterCount ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Supporters</p>
            </div>
          </button>
          <div className="flex items-center gap-3 p-2 sm:p-3 rounded-xl bg-background/60 backdrop-blur-sm border border-border">
            <span className="text-base sm:text-lg mx-1">🎁</span>
            <div>
              <p className="text-2xl sm:text-2xl font-bold">{depositCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Contributions</p>
            </div>
          </div>
        </div>

        {/* 설명 - 말풍선 스타일 */}
        <div className="relative p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/30">
          <div className="absolute -top-2 left-4 sm:left-6 w-4 h-4 bg-muted/30 border-l border-t border-border/30 rotate-45" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {fundT('fund_desc')}
          </p>
        </div>

        {/* BuyFanzTokenDialog */}
        {fanzToken && buyCostUsd && buyCostUsd > 0 && onchainSupply !== null && (
          <BuyFanzTokenDialog
            open={isBuyDialogOpen}
            onOpenChange={setIsBuyDialogOpen}
            tokenId={fanzToken.id}
            onchainBuyCostUsd={buyCostUsd}
            reserveCostUsd={reserveAmount ?? undefined}
            artistFundFeeUsd={communityFundAmount ?? undefined}
            platformFeeUsd={platformFeeAmount ?? undefined}
            currentSupply={onchainSupply}
            onPurchaseSuccess={() => {
              setIsBuyDialogOpen(false);
            }}
          />
        )}

        {/* 트랜잭션 히스토리 */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📜</span>
            <span className="text-base font-semibold">{fundT('recent_activity')}</span>
          </div>
          
          {isLoadingTransactions ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-6 rounded-xl bg-muted/20 border border-dashed border-border/50">
              <span className="text-3xl mb-2 block">🌱</span>
              <p className="text-base text-muted-foreground">{fundT('no_contributions')}</p>
              <p className="text-sm text-muted-foreground/70">{fundT('be_first')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[180px]">
              <div className="space-y-2">
                {transactions.map((tx, idx) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/40 hover:bg-background/60 transition-colors border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{idx === 0 ? '🔥' : '✨'}</span>
                      <div>
                        <span className="font-bold text-primary">
                          +${Math.abs(Number(tx.amount)).toFixed(2)}
                        </span>
                        <p className="text-xs text-muted-foreground">@{tx.profiles?.username || 'anon'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground/70">
                      {format(new Date(tx.created_at), 'MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Fund Supporters Dialog */}
        <Dialog open={isHoldersDialogOpen} onOpenChange={setIsHoldersDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm" hideCloseButton>
            <div className="flex justify-end -mb-2">
              <DialogClose className="rounded-full p-1.5 hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            <DialogHeader>
              <DialogTitle>Supporters ({supporterCount ?? 0})</DialogTitle>
              <DialogDescription>People who contributed to this fund</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {(() => {
                  // 트랜잭션에서 고유 유저별 총 기여금액 계산
                  const userMap = new Map<string, { username: string; avatar_url: string | null; total: number }>();
                  (transactions ?? []).forEach(tx => {
                    const uid = tx.user_id;
                    const existing = userMap.get(uid);
                    if (existing) {
                      existing.total += Math.abs(Number(tx.amount));
                    } else {
                      userMap.set(uid, {
                        username: tx.profiles?.username || 'anon',
                        avatar_url: tx.profiles?.avatar_url || null,
                        total: Math.abs(Number(tx.amount)),
                      });
                    }
                  });
                  const supporters = Array.from(userMap.values()).sort((a, b) => b.total - a.total);
                  if (supporters.length === 0) {
                    return <p className="text-center text-sm text-muted-foreground py-4">No supporters yet</p>;
                  }
                  return supporters.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                        <Avatar className="h-9 w-9" seed={s.username}>
                          <AvatarImage src={s.avatar_url || undefined} alt={s.username} />
                          <AvatarFallback>{s.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold">@{s.username}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">${s.total.toFixed(2)}</span>
                    </div>
                  ));
                })()}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

interface FundDetailsProps {
  totalFund: number;
  depositCount: number;
  supporterCount: number;
  transactions: FundTransaction[];
  isLoadingTransactions: boolean;
}

const FundDetails = ({ totalFund, depositCount, supporterCount, transactions, isLoadingTransactions }: FundDetailsProps) => {
  return (
    <div className="space-y-4">
      {/* 잔액 및 서포터 수 표시 */}
      <div className="text-center py-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
        <p className="text-sm text-muted-foreground mb-1">Total Fund Balance</p>
        <p className="text-3xl font-bold text-primary">${Number(totalFund).toFixed(2)}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{supporterCount} Supporters</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Coins className="w-4 h-4" />
            <span>{depositCount} Contributions</span>
          </div>
        </div>
      </div>

      {/* 설명 */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
        <p>
          20% of every LightStick purchase is deposited as a sponsorship fund. 
          LightStick holders can vote and decide on how to use it for fan events, ads, and community rewards.
        </p>
      </div>

      {/* 트랜잭션 히스토리 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Contributions</span>
        </div>
        
        {isLoadingTransactions ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No contributions yet. Be the first supporter!
          </p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {transactions.map(tx => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={(tx.transaction_type === 'deposit' || tx.transaction_type === 'contribution') ? 'text-primary' : 'text-destructive'}>
                      {(tx.transaction_type === 'deposit' || tx.transaction_type === 'contribution') ? '+' : '-'}
                    </span>
                    <span className="font-medium">
                      ${Math.abs(Number(tx.amount)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>@{tx.profiles?.username || 'user'}</span>
                    <span>·</span>
                    <span>{format(new Date(tx.created_at), 'MMM d')}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default SupportFundCard;
