import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchTokenDisplayPrice } from "@/hooks/useFanzTokenPrice";

import V2Layout from "@/components/home/V2Layout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wand2, TrendingUp, ExternalLink, CheckCircle2, Crown, Star, Award, Medal, Gem } from "lucide-react";

// 팬 랭크 계산 함수
const getFanRank = (tokenBalance: number) => {
  if (tokenBalance >= 100) return { name: "Diamond Fan", icon: Gem, color: "text-cyan-400", bgColor: "bg-cyan-400/10", weight: "5x" };
  if (tokenBalance >= 50) return { name: "Gold Fan", icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-500/10", weight: "4x" };
  if (tokenBalance >= 20) return { name: "Silver Fan", icon: Medal, color: "text-slate-400", bgColor: "bg-slate-400/10", weight: "3x" };
  if (tokenBalance >= 5) return { name: "Bronze Fan", icon: Award, color: "text-amber-600", bgColor: "bg-amber-600/10", weight: "2x" };
  return { name: "Rookie Fan", icon: Star, color: "text-green-500", bgColor: "bg-green-500/10", weight: "1.5x" };
};
import { useToast } from "@/hooks/use-toast";
import AdminFanzTokenTransferCard from "@/components/admin/AdminFanzTokenTransferCard";
import SellFanzTokenDialog from "@/components/SellFanzTokenDialog";
import BuyFanzTokenDialog from "@/components/BuyFanzTokenDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface FanzTokenBalance {
  id: string;
  balance: number;
  /**
   * DB에 기록된 잔액(과거 기록/캐시)
   * - UI 표시용으로만 사용하고, 판매 가능 여부는 온체인을 기준으로 한다.
   */
  dbBalance?: number;
  /**
   * 온체인에서 확인된 실제 잔액
   */
  onchainBalance?: number;
  fanz_token: {
    id: string;
    token_id: string;
    base_price: number;
    k_value: number;
    total_supply: number;
    wiki_entry_id: string | null;
    post_id: string | null;
  };
  wiki_entry?: {
    id: string;
    title: string;
    image_url: string | null;
    slug: string;
    follower_count: number;
    trending_score: number;
  };
  post?: {
    id: string;
    title: string;
    image_url: string | null;
  };
  token_buy_cost_eth?: number | null;
  onchainSupply?: number;
  onchainUserHeldSupply?: number;
  onchainPriceUsd?: number;
  isOnchainVerified?: boolean; // 온체인 잔액이 0보다 큰지 여부
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  total_value: number;
  created_at: string;
  fanz_token: {
    wiki_entry_id: string | null;
    post_id: string | null;
  };
  wiki_entry?: {
    title: string;
    image_url: string | null;
    slug: string;
  };
  post?: {
    title: string;
    image_url: string | null;
  };
}

const FANZTOKEN_CONTRACT_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7"; // V5 컨트랙트 (Basescan 링크용)
 
const MyFanzTokens = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { wallet, isLoading: walletLoading } = useWallet();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [balances, setBalances] = useState<FanzTokenBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<FanzTokenBalance | null>(null);
  const [selectedBuyToken, setSelectedBuyToken] = useState<FanzTokenBalance | null>(null);
  const [availablePoints, setAvailablePoints] = useState(0);

  // 중복 검증 방지를 위한 ref
  const verificationInProgress = useRef(false);

  useEffect(() => {
    // 로딩 중일 때는 리다이렉트하지 않음
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // availablePoints 가져오기
    const fetchAvailablePoints = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('available_points')
        .eq('id', user.id)
        .single();
      if (data) setAvailablePoints(data.available_points);
    };
    fetchAvailablePoints();

    // 잔액 조회 함수 (에지 함수를 통해 온체인 잔액 확인 - Alchemy RPC 사용)
    const fetchBalances = async () => {
      try {
        setLoading(true);

        // smart_wallet과 external wallet 주소 모두 조회
        const { data: allWallets } = await supabase
          .from('wallet_addresses')
          .select('wallet_address, wallet_type')
          .eq('user_id', user.id);

        const walletAddresses = (allWallets || []).map(w => w.wallet_address).filter(Boolean);
        
        if (walletAddresses.length === 0) {
          console.log("No wallet addresses available");
          setBalances([]);
          return;
        }

        console.log("Fetching balances for wallets:", walletAddresses);

        // wiki_entry, post를 한 번에 JOIN으로 가져와 N+1 문제 해결
        // total_supply > 0 인 토큰만 조회
        const { data: tokenRows, error: tokenError } = await supabase
          .from('fanz_tokens')
          .select(`
            id,
            token_id,
            base_price,
            k_value,
            total_supply,
            wiki_entry_id,
            post_id,
            wiki_entries!fanz_tokens_wiki_entry_id_fkey (
              id,
              title,
              image_url,
              slug,
              follower_count,
              trending_score
            ),
            posts!fanz_tokens_post_id_fkey (
              id,
              title,
              image_url
            )
          `)
          .gt('total_supply', 0)
          .order('total_supply', { ascending: false })
          .limit(200);

        if (tokenError) throw tokenError;

        const tokens = tokenRows || [];
        if (tokens.length === 0) {
          setBalances([]);
          return;
        }

        // 에지 함수를 통해 온체인 잔액 조회 (첫 번째 지갑 기준으로 후보 탐색 수행)
        const tokenList = tokens.map((t: any) => ({ tokenId: t.token_id }));

        // 단일 호출로 모든 후보 주소에서 잔액 조회 (Edge Function이 내부적으로 후보 탐색)
        const { data: onchainData, error: onchainError } = await supabase.functions.invoke(
          'get-user-fanz-balances',
          {
            body: {
              walletAddress: walletAddresses[0], // 첫 번째 지갑 주소 (Edge Function이 모든 후보를 탐색)
              tokens: tokenList,
              userId: user.id,
              includeMeta: false, // 메타 정보 제외하여 속도 개선
            },
          }
        );

        if (onchainError) {
          console.error('Edge function error:', onchainError);
          throw onchainError;
        }

        // 온체인 결과를 맵으로 변환
        const onchainMap = new Map<string, { balance: number; totalSupply?: number; userHeldSupply?: number; priceUsd?: number }>();
        (onchainData?.balances || []).forEach((item: any) => {
          onchainMap.set(item.tokenId, {
            balance: Number(item.balance ?? 0),
            totalSupply: item.totalSupply,
            userHeldSupply: item.userHeldSupply,
            priceUsd: item.priceUsd,
          });
        });

        // 온체인 잔액이 있는 토큰만 필터링 (N+1 쿼리 없이 즉시 처리)
        const filteredBalances: FanzTokenBalance[] = [];
        
        for (const tokenData of tokens) {
          const onchain = onchainMap.get(tokenData.token_id);
          const onchainBalance = Number(onchain?.balance ?? 0);

          // 온체인 잔액이 없으면 제외
          if (onchainBalance <= 0) continue;

          filteredBalances.push({
            id: tokenData.id,
            balance: onchainBalance,
            dbBalance: 0,
            onchainBalance,
            fanz_token: {
              id: tokenData.id,
              token_id: tokenData.token_id,
              base_price: tokenData.base_price,
              k_value: tokenData.k_value,
              total_supply: tokenData.total_supply,
              wiki_entry_id: tokenData.wiki_entry_id,
              post_id: tokenData.post_id,
            },
            wiki_entry: tokenData.wiki_entries || undefined,
            post: tokenData.posts || undefined,
            onchainSupply: onchain?.totalSupply,
            onchainUserHeldSupply: onchain?.userHeldSupply,
            onchainPriceUsd: 0, // 아래에서 fetchTokenDisplayPrice로 정확한 가격 채움
            isOnchainVerified: true,
          });
        }

        // 공통 가격 함수로 정확한 표시 가격 조회 (엔트리 페이지와 동일한 값)
        const pricePromises = filteredBalances.map((b) => fetchTokenDisplayPrice(b.fanz_token.token_id));
        const prices = await Promise.all(pricePromises);
        prices.forEach((price, i) => {
          filteredBalances[i].onchainPriceUsd = price;
        });

        setBalances(filteredBalances);
      } catch (error: any) {
        console.error('Error fetching fanz token balances:', error);
        toast({
          title: "Error",
          description: "Failed to load your lightsticks. Please try again.",
          variant: "destructive",
        });
        setBalances([]);
      } finally {
        setLoading(false);
      }
    };

    // 결제 성공/취소 처리는 FanzTokenButton.tsx에서 담당 (중복 방지)

    // 거래 내역 조회 함수
    const fetchTransactions = async () => {
      try {
        setTransactionsLoading(true);
        const { data, error } = await supabase
          .from('fanz_transactions')
          .select(`
            id,
            transaction_type,
            amount,
            total_value,
            created_at,
            fanz_token:fanz_tokens!fanz_transactions_fanz_token_id_fkey (
              wiki_entry_id,
              post_id
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const transactionsWithDetails = await Promise.all(
          (data || []).map(async (tx: any) => {
            const tokenData = tx.fanz_token;

            if (tokenData?.wiki_entry_id) {
              const { data: wikiData } = await supabase
                .from('wiki_entries')
                .select('title, image_url, slug')
                .eq('id', tokenData.wiki_entry_id)
                .single();

              return {
                ...tx,
                wiki_entry: wikiData,
              };
            } else if (tokenData?.post_id) {
              const { data: postData } = await supabase
                .from('posts')
                .select('title, image_url')
                .eq('id', tokenData.post_id)
                .single();

              return {
                ...tx,
                post: postData,
              };
            }

            return tx;
          })
        );

        setTransactions(transactionsWithDetails);
      } catch (error: any) {
        console.error('Error fetching transactions:', error);
        toast({
          title: "Error",
          description: "Failed to load transaction history",
          variant: "destructive",
        });
      } finally {
        setTransactionsLoading(false);
      }
    };

    // 결제 성공/취소 처리는 FanzTokenButton.tsx에서 담당
    
    // 잔액 조회 (더 이상 wallet 로드 조건 없이 user만 확인)
    fetchBalances();
    fetchTransactions();
  }, [user, navigate, toast]);

  const handleEntryClick = (balance: FanzTokenBalance) => {
    if (balance.wiki_entry) {
      navigate(`/fanz/${balance.wiki_entry.slug}`);
    } else if (balance.post) {
      navigate(`/p/${balance.post.id}`);
    }
  };

  const handleSellClick = (balance: FanzTokenBalance, e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지

    // 온체인 잔액이 0이어도(지갑 변경/동기화 지연 등) 판매 플로우를 막지 않는다.
    // sell-fanz-token Edge Function이 실제 보유 지갑을 탐색/복구한 뒤 판매를 시도한다.
    setSelectedToken(balance);
    setSellDialogOpen(true);
  };

  const handleSellSuccess = () => {
    // 판매 성공 후 온체인 데이터 새로고침 (DB 의존 없이 온체인 기준)
    if (user) {
      const refreshBalances = async () => {
        try {
          // smart_wallet과 external wallet 주소 모두 조회
          const { data: allWallets } = await supabase
            .from('wallet_addresses')
            .select('wallet_address, wallet_type')
            .eq('user_id', user.id);

          const walletAddresses = (allWallets || []).map(w => w.wallet_address).filter(Boolean);
          
          if (walletAddresses.length === 0) return;

          // wiki_entry, post를 한 번에 JOIN으로 가져와 N+1 문제 해결
          const { data: tokenRows, error: tokenError } = await supabase
            .from('fanz_tokens')
            .select(`
              id,
              token_id,
              base_price,
              k_value,
              total_supply,
              wiki_entry_id,
              post_id,
              wiki_entries!fanz_tokens_wiki_entry_id_fkey (
                id,
                title,
                image_url,
                slug,
                follower_count,
                trending_score
              ),
              posts!fanz_tokens_post_id_fkey (
                id,
                title,
                image_url
              )
            `)
            .gt('total_supply', 0)
            .order('total_supply', { ascending: false })
            .limit(200);

          if (tokenError) throw tokenError;

          const tokens = tokenRows || [];
          if (tokens.length === 0) {
            setBalances([]);
            return;
          }

          // 에지 함수를 통해 온체인 잔액 조회 (첫 번째 지갑 기준으로 후보 탐색 수행)
          const tokenList = tokens.map((t: any) => ({ tokenId: t.token_id }));

          // 단일 호출로 모든 후보 주소에서 잔액 조회 (Edge Function이 내부적으로 후보 탐색)
          const { data: onchainData, error: onchainError } = await supabase.functions.invoke(
            'get-user-fanz-balances',
            {
              body: {
                walletAddress: walletAddresses[0], // 첫 번째 지갑 주소 (Edge Function이 모든 후보를 탐색)
                tokens: tokenList,
                userId: user.id,
                includeMeta: false, // 메타 정보 제외하여 속도 개선
              },
            }
          );

          if (onchainError) {
            console.error('Edge function error:', onchainError);
            throw onchainError;
          }

          // 온체인 결과를 맵으로 변환
          const onchainMap = new Map<string, { balance: number; totalSupply?: number; userHeldSupply?: number; priceUsd?: number }>();
          (onchainData?.balances || []).forEach((item: any) => {
            onchainMap.set(item.tokenId, {
              balance: Number(item.balance ?? 0),
              totalSupply: item.totalSupply,
              userHeldSupply: item.userHeldSupply,
              priceUsd: item.priceUsd,
            });
          });

          // 온체인 잔액이 있는 토큰만 필터링 (N+1 쿼리 없이 즉시 처리)
          const filteredBalances: FanzTokenBalance[] = [];
          
          for (const tokenData of tokens) {
            const onchain = onchainMap.get(tokenData.token_id);
            const onchainBalance = Number(onchain?.balance ?? 0);

            // 온체인 잔액이 없으면 제외
            if (onchainBalance <= 0) continue;

            filteredBalances.push({
              id: tokenData.id,
              balance: onchainBalance,
              dbBalance: 0,
              onchainBalance,
              fanz_token: {
                id: tokenData.id,
                token_id: tokenData.token_id,
                base_price: tokenData.base_price,
                k_value: tokenData.k_value,
                total_supply: tokenData.total_supply,
                wiki_entry_id: tokenData.wiki_entry_id,
                post_id: tokenData.post_id,
              },
              wiki_entry: tokenData.wiki_entries || undefined,
              post: tokenData.posts || undefined,
              onchainSupply: onchain?.totalSupply,
              onchainUserHeldSupply: onchain?.userHeldSupply,
              onchainPriceUsd: 0,
              isOnchainVerified: true,
            });
          }

          // 공통 가격 함수로 정확한 표시 가격 조회
          const pricePromises = filteredBalances.map((b) => fetchTokenDisplayPrice(b.fanz_token.token_id));
          const prices = await Promise.all(pricePromises);
          prices.forEach((price, i) => {
            filteredBalances[i].onchainPriceUsd = price;
          });

          setBalances(filteredBalances);
        } catch (error: any) {
          console.error('Error refreshing balances:', error);
        }
      };

      refreshBalances();
    }
  };

  return (
    <V2Layout pcHeaderTitle="My Lightsticks" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4`}>

        {isAdmin && (
          <div className="mb-6">
            <AdminFanzTokenTransferCard defaultToAddress={wallet?.wallet_address ?? ""} />
          </div>
        )}

          <Tabs defaultValue="tokens" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
              <TabsTrigger value="tokens" className="h-full">Lightsticks</TabsTrigger>
              <TabsTrigger value="history" className="h-full">Transaction History</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens">

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-16 h-16 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : balances.length === 0 ? (
            <Card className="p-12 text-center">
              <Wand2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Lightsticks Yet</h3>
              <p className="text-muted-foreground">
                Purchase lightsticks from your favorite Fanz entries to support them!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {balances.map((balance) => {
                const entry = balance.wiki_entry || balance.post;
                if (!entry) return null;


                // fetchTokenDisplayPrice로 이미 Stripe 수수료 포함된 정확한 표시 가격
                const priceWithStripeUSD = balance.onchainPriceUsd ?? 0;
                const totalSupply = balance.onchainSupply ?? balance.fanz_token.total_supply;

                // DB token_id는 이미 keccak256 해싱된 uint256 값
                const tokenIdUint = BigInt(balance.fanz_token.token_id);
                const basescanUrl = `https://basescan.org/token/${FANZTOKEN_CONTRACT_ADDRESS}?a=${tokenIdUint.toString()}#balances`;

                const fanRank = getFanRank(balance.balance);
                const FanRankIcon = fanRank.icon;

                return (
                  <Card key={balance.id} className="p-3 hover:shadow-lg transition-all">
                    <div className="flex flex-col gap-3">
                      {/* 이미지 - 전체 너비 */}
                      <div
                        className="w-full aspect-[4/3] rounded-lg overflow-hidden relative cursor-pointer"
                        onClick={() => handleEntryClick(balance)}
                      >
                        <img
                          src={entry.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.title)}&size=200&background=random`}
                          alt={entry.title}
                          className="w-full h-full object-cover"
                        />
                        {balance.wiki_entry && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {balance.wiki_entry.trending_score}
                          </div>
                        )}
                        {/* 등급+수량 오버레이 - 하단 중앙 */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 bg-black/80 text-white px-3 py-1.5 rounded-full shadow-lg">
                            <FanRankIcon className={`w-4 h-4 ${fanRank.color}`} />
                            <span className="text-xs">{fanRank.name}</span>
                            <span className="w-px h-3 bg-white/30 mx-0.5" />
                            <Wand2 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm">x{balance.balance}</span>
                          </div>
                        </div>
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        {/* 제목 */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 
                            className="font-bold text-base text-foreground line-clamp-1 cursor-pointer hover:text-primary"
                            onClick={() => handleEntryClick(balance)}
                          >
                            {entry.title}
                          </h3>
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        </div>
                        
                        {/* 공급량 / 가격 / Basescan */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span className="font-medium">{totalSupply}</span>
                          </div>
                          <div className="font-bold text-foreground">
                            {priceWithStripeUSD > 0 
                              ? priceWithStripeUSD.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : "--"}
                          </div>
                          <a
                            href={basescanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Basescan
                          </a>
                        </div>

                        {!balance.isOnchainVerified && (
                          <div className="text-[11px] text-muted-foreground mb-2">
                            Showing database balance (on-chain sync pending)
                          </div>
                        )}
                        
                        {/* 버튼들 */}
                        <div className="flex items-center justify-center gap-3 py-3">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedBuyToken(balance);
                              setBuyDialogOpen(true);
                            }}
                            className="h-9 px-6 text-sm font-semibold rounded-full flex-1 max-w-[140px]"
                          >
                            Support
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleSellClick(balance, e)}
                            className="h-9 px-6 text-sm font-medium rounded-full flex-1 max-w-[140px] text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            Return
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
            </TabsContent>

            <TabsContent value="history">
              {transactionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <Card className="p-12 text-center">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Transactions Yet</h3>
                  <p className="text-muted-foreground">
                    Your transaction history will appear here
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const entry = tx.wiki_entry || tx.post;
                    if (!entry) return null;

                    return (
                      <Card 
                        key={tx.id}
                        className="p-4 hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => {
                          if (tx.wiki_entry) {
                            navigate(`/fanz/${tx.wiki_entry.slug}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                            <img
                              src={entry.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.title)}&size=100&background=random`}
                              alt={entry.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {entry.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <div className={`font-bold text-sm ${tx.transaction_type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.transaction_type === 'buy' ? '+' : '-'}{tx.amount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${Number(tx.total_value).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
      </div>

      {selectedToken && (
        <SellFanzTokenDialog
          open={sellDialogOpen}
          onOpenChange={setSellDialogOpen}
          tokenId={selectedToken.fanz_token.id}
          onchainTokenId={selectedToken.fanz_token.token_id}
          currentSupply={selectedToken.onchainSupply ?? selectedToken.fanz_token.total_supply}
          availableBalance={selectedToken.balance}
          onSellSuccess={handleSellSuccess}
        />
      )}

      {selectedBuyToken && selectedBuyToken.onchainPriceUsd && selectedBuyToken.onchainPriceUsd > 0 && (
        <BuyFanzTokenDialog
          open={buyDialogOpen}
          onOpenChange={setBuyDialogOpen}
          tokenId={selectedBuyToken.fanz_token.id}
          onchainBuyCostUsd={selectedBuyToken.onchainPriceUsd}
          currentSupply={selectedBuyToken.onchainUserHeldSupply || 0}
          onPurchaseSuccess={() => {
            setBuyDialogOpen(false);
            // 잔액 새로고침
            window.location.reload();
          }}
        />
      )}
    </V2Layout>
  );
};

export default MyFanzTokens;
