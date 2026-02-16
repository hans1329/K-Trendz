import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowUpRight, Minus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface WatchlistEntry {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  follower_count: number;
  trending_score: number;
  fanz_token?: {
    id: string;
    token_id: string;
    total_supply: number;
  } | null;
  myBalance: number;
  currentSupply: number;
  currentPriceUSD: number;
  nextPriceUSD: number;
}

// 공통 가격 함수 사용 (useFanzTokenPrice 훅과 동일한 소스)
import { fetchTokenDisplayPrice, fetchTokenPriceData, calculateStripeTotal } from "@/hooks/useFanzTokenPrice";

const MyWatchlist = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const { wallet, isLoading: walletLoading } = useWallet();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchWatchlist = async () => {
      try {
        setLoading(true);

        // 1. 사용자가 팔로우하는 엔트리 ID 가져오기
        const { data: followData, error: followError } = await supabase
          .from('wiki_entry_followers')
          .select('wiki_entry_id')
          .eq('user_id', user.id);

        if (followError) throw followError;
        if (!followData || followData.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }

        // 2. 팔로우한 엔트리의 상세 정보 가져오기
        const followedEntryIds = followData.map((f) => f.wiki_entry_id);
        const { data: entriesData, error: entriesError } = await supabase
          .from('wiki_entries')
          .select('id, title, slug, image_url, follower_count, trending_score')
          .in('id', followedEntryIds);

        if (entriesError) throw entriesError;
        if (!entriesData || entriesData.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }

        // 3. 각 엔트리의 fanz_token 정보 가져오기
        const entryIds = entriesData.map((e) => e.id);
        const { data: tokenData } = await supabase
          .from('fanz_tokens')
          .select('id, token_id, total_supply, wiki_entry_id')
          .in('wiki_entry_id', entryIds)
          .eq('is_active', true);

        const tokenMap = new Map(tokenData?.map(t => [t.wiki_entry_id, t]) || []);

        // 4. 사용자의 fanz_balances 가져오기 (내 보유량)
        let balanceMap = new Map<string, number>();
        if (wallet?.wallet_address && tokenData && tokenData.length > 0) {
          const tokenIds = tokenData.map(t => t.id);
          const { data: balanceData } = await supabase
            .from('fanz_balances')
            .select('fanz_token_id, balance')
            .eq('user_id', user.id)
            .in('fanz_token_id', tokenIds);
          
          if (balanceData) {
            balanceMap = new Map(balanceData.map(b => [b.fanz_token_id, Number(b.balance)]));
          }
        }

        // 5. 공통 가격 함수로 온체인 가격 조회 (병렬)
        const onchainPriceMap = new Map<string, number>();
        if (tokenData && tokenData.length > 0) {
          const priceResults = await Promise.all(
            tokenData.map(async (token) => {
              const price = await fetchTokenDisplayPrice(token.token_id);
              return { tokenId: token.token_id, price };
            })
          );
          priceResults.forEach(({ tokenId, price }) => {
            if (price > 0) {
              onchainPriceMap.set(tokenId, price);
            }
          });
        }

        // 6. 가격 데이터 기반으로 엔트리 구성
        const entriesWithData = entriesData.map((entry) => {
          const token = tokenMap.get(entry.id);
          
          let myBalance = 0;
          let currentSupply = 0;
          let currentPriceUSD = 0;
          let nextPriceUSD = 0;

          if (token) {
            currentSupply = Number(token.total_supply ?? 0);
            myBalance = balanceMap.get(token.id) || 0;
            
            const displayPrice = onchainPriceMap.get(token.token_id);
            if (displayPrice) {
              currentPriceUSD = displayPrice;
              nextPriceUSD = currentPriceUSD * 1.03;
            }
          }

          return {
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            image_url: entry.image_url,
            follower_count: entry.follower_count,
            trending_score: entry.trending_score,
            fanz_token: token ? {
              id: token.id,
              token_id: token.token_id,
              total_supply: currentSupply,
            } : null,
            myBalance,
            currentSupply,
            currentPriceUSD,
            nextPriceUSD,
          };
        });

        // 응원봉 보유량 우선 정렬, 그 다음 트렌딩 스코어
        entriesWithData.sort((a, b) => {
          if (b.myBalance !== a.myBalance) return b.myBalance - a.myBalance;
          return b.trending_score - a.trending_score;
        });

        setEntries(entriesWithData);
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!walletLoading) {
      fetchWatchlist();
    }
  }, [user, wallet, walletLoading, authLoading, navigate]);

  const handleEntryClick = (entry: WatchlistEntry) => {
    navigate(`/k/${entry.slug}`);
  };

  return (
    <V2Layout pcHeaderTitle="My Watchlist" showBackButton={true} showMobileHeader={false}>
      <div className={`${isMobile ? 'pt-12 px-3' : ''} pb-4`}>
        <div className="max-w-2xl mx-auto">

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Entries Yet</h3>
              <p className="text-sm text-muted-foreground">
                Follow your favorite artists and groups to see them here!
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* 데스크톱 헤더 - 모바일에서 숨김 */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground font-medium">
                <div className="col-span-5">Entry</div>
                <div className="col-span-2 text-right">Supply</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Next</div>
                <div className="col-span-1 text-right">Value</div>
              </div>

              {entries.map((entry) => {
                const priceChange = entry.nextPriceUSD > 0 && entry.currentPriceUSD > 0
                  ? ((entry.nextPriceUSD - entry.currentPriceUSD) / entry.currentPriceUSD) * 100
                  : 0;
                const totalValue = entry.myBalance * entry.currentPriceUSD;

                return (
                  <Card 
                    key={entry.id} 
                    className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEntryClick(entry)}
                  >
                    {/* 모바일 레이아웃 */}
                    <div className="md:hidden">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-12 h-12 rounded-lg shrink-0">
                          <AvatarImage src={entry.image_url || undefined} className="object-cover" />
                          <AvatarFallback className="rounded-lg text-xs">
                            {entry.title.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{entry.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {entry.follower_count} followers
                          </p>
                        </div>
                        {totalValue > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">${totalValue.toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">value</p>
                          </div>
                        )}
                      </div>
                      
                      {entry.fanz_token && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Supply</p>
                            <p className="text-sm font-medium text-foreground">{entry.currentSupply}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="text-sm font-bold text-foreground">
                              {entry.currentPriceUSD > 0 ? `$${entry.currentPriceUSD.toFixed(2)}` : '-'}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Next</p>
                            <div className="flex items-center justify-center gap-1">
                              <p className="text-sm text-muted-foreground">
                                {entry.nextPriceUSD > 0 ? `$${entry.nextPriceUSD.toFixed(2)}` : '-'}
                              </p>
                              {priceChange > 0 && <ArrowUpRight className="w-3 h-3 text-green-500" />}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 데스크톱 레이아웃 */}
                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                      {/* 엔트리 정보 */}
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <Avatar className="w-10 h-10 rounded-lg shrink-0">
                          <AvatarImage src={entry.image_url || undefined} className="object-cover" />
                          <AvatarFallback className="rounded-lg text-xs">
                            {entry.title.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{entry.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {entry.follower_count}
                          </p>
                        </div>
                      </div>

                      {/* 발행량 */}
                      <div className="col-span-2 text-right">
                        {entry.fanz_token ? (
                          <span className="text-sm font-medium text-foreground">
                            {entry.currentSupply}
                          </span>
                        ) : (
                          <Minus className="w-4 h-4 text-muted-foreground ml-auto" />
                        )}
                      </div>

                      {/* 현재가 */}
                      <div className="col-span-2 text-right">
                        {entry.fanz_token && entry.currentPriceUSD > 0 ? (
                          <span className="text-sm font-bold text-foreground">
                            ${entry.currentPriceUSD.toFixed(2)}
                          </span>
                        ) : (
                          <Minus className="w-4 h-4 text-muted-foreground ml-auto" />
                        )}
                      </div>

                      {/* 다음가 */}
                      <div className="col-span-2 text-right">
                        {entry.fanz_token && entry.nextPriceUSD > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-sm text-muted-foreground">
                              ${entry.nextPriceUSD.toFixed(2)}
                            </span>
                            {priceChange > 0 && (
                              <ArrowUpRight className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                        ) : (
                          <Minus className="w-4 h-4 text-muted-foreground ml-auto" />
                        )}
                      </div>

                      {/* 총 가치 */}
                      <div className="col-span-1 text-right">
                        {entry.myBalance > 0 && entry.currentPriceUSD > 0 ? (
                          <span className="text-sm font-bold text-primary">
                            ${totalValue.toFixed(0)}
                          </span>
                        ) : (
                          <Minus className="w-4 h-4 text-muted-foreground ml-auto" />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </V2Layout>
  );
};

export default MyWatchlist;
