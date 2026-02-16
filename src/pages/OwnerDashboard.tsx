import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerStatus } from "@/hooks/useOwnerStatus";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useFanzTokenPrice } from "@/hooks/useFanzTokenPrice";
import { ethers } from "ethers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SupportFundCard from "@/components/SupportFundCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  Gem,
  Bell,
  Crown,
  Mail,
  MessageCircle,
  Rocket,
  ShoppingCart,
  ChevronDown
} from "lucide-react";

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { isOwner, isLoading: ownerLoading, ownedEntries, isLoadingEntries } = useOwnerStatus();
  
  // 선택된 페이지 인덱스
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);

  // 선택된 엔트리
  const selectedEntry = ownedEntries[selectedEntryIndex] || ownedEntries[0];

  // 쌓인 수수료 조회 (fanz_transactions creator_fee만 - USD)
  const { data: accumulatedFees = 0, isLoading: isLoadingFees } = useQuery({
    queryKey: ['ownerAccumulatedFees', user?.id, ownedEntries.map(e => e.id)],
    queryFn: async () => {
      if (!user?.id || ownedEntries.length === 0) return 0;
      
      const entryIds = ownedEntries.map(e => e.id);
      
      // 소유한 엔트리의 토큰 조회
      const { data: tokens, error: tokensError } = await supabase
        .from('fanz_tokens')
        .select('id')
        .in('wiki_entry_id', entryIds);
      
      if (tokensError) {
        console.error('Tokens fetch error:', tokensError);
        return 0;
      }
      
      if (!tokens || tokens.length === 0) return 0;

      const tokenIds = tokens.map(t => t.id);
      
      // fanz_transactions에서 creator_fee 합계 (USD로 저장됨)
      const { data: transactions, error: txError } = await supabase
        .from('fanz_transactions')
        .select('creator_fee')
        .in('fanz_token_id', tokenIds);
      
      if (txError) {
        console.error('Transactions fetch error:', txError);
        return 0;
      }
      
      const totalUsd = transactions?.reduce((sum, t) => sum + Number(t.creator_fee || 0), 0) || 0;
      console.log('Accumulated fees calculation:', { totalUsd, transactionCount: transactions?.length });
      return totalUsd;
    },
    enabled: !!user?.id && ownedEntries.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // 응원봉 현재가 조회 (공통 hook 사용 - FanzTokenButton과 동일)
  const { 
    priceWithStripeUSD: currentPrice, 
    userHeldSupply,
    isLoading: isLoadingPrice 
  } = useFanzTokenPrice(selectedEntry?.id);

  // 내 보유량 조회
  const { data: myBalance = 0, isLoading: isLoadingBalance } = useQuery({
    queryKey: ['ownerMyBalance', user?.id, selectedEntry?.id],
    queryFn: async () => {
      if (!user?.id || !selectedEntry?.id) return 0;
      
      const { data: token } = await supabase
        .from('fanz_tokens')
        .select('id, token_id')
        .eq('wiki_entry_id', selectedEntry.id)
        .maybeSingle();
      
      if (!token?.token_id) return 0;

      // 온체인 보유량 조회
      const { data: walletData } = await supabase
        .from('wallet_addresses')
        .select('wallet_address')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!walletData?.wallet_address) return 0;

      try {
        // Alchemy RPC 우선 사용
        const rpcUrl = "https://base-mainnet.g.alchemy.com/v2/lQ8d0CvmXnkOFaDOywREJnUr4kCEE3n1";
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(
          "0x5cf3E0CCF5E7965eC0a17e8B3ac1cAE370Acc6Be",
          ["function balanceOf(address account, uint256 id) external view returns (uint256)"],
          provider
        );
        const tokenIdBigInt = BigInt(token.token_id);
        return Number(await contract.balanceOf(walletData.wallet_address, tokenIdBigInt));
      } catch (error) {
        console.error('Error fetching balance:', error);
        return 0;
      }
    },
    enabled: !!user?.id && !!selectedEntry?.id,
    staleTime: 1000 * 60 * 2,
  });

  const isLoadingTokenInfo = isLoadingPrice || isLoadingBalance;
  const tokenInfo = {
    currentPrice,
    myBalance,
    myValue: myBalance * currentPrice,
  };

  // Top Holders 조회
  const { data: topHolders = [], isLoading: isLoadingHolders } = useQuery({
    queryKey: ['ownerTopHolders', selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry?.id) return [];
      
      const { data: token } = await supabase
        .from('fanz_tokens')
        .select('id')
        .eq('wiki_entry_id', selectedEntry.id)
        .single();
      
      if (!token) return [];

      const { data: holders } = await supabase
        .from('fanz_balances')
        .select(`
          balance,
          user_id,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('fanz_token_id', token.id)
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(5);
      
      return holders || [];
    },
    enabled: !!selectedEntry?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Recent Activity 조회
  const { data: recentActivity = [], isLoading: isLoadingActivity } = useQuery({
    queryKey: ['ownerRecentActivity', selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry?.id) return [];
      
      const { data: token } = await supabase
        .from('fanz_tokens')
        .select('id')
        .eq('wiki_entry_id', selectedEntry.id)
        .single();
      
      if (!token) return [];

      // 최근 거래 내역
      const { data: transactions } = await supabase
        .from('fanz_transactions')
        .select(`
          amount,
          transaction_type,
          total_value,
          created_at,
          user_id,
          profiles:user_id (
            username,
            display_name
          )
        `)
        .eq('fanz_token_id', token.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // 최근 댓글
      const { data: comments } = await supabase
        .from('comments')
        .select('created_at, user_id')
        .eq('wiki_entry_id', selectedEntry.id)
        .order('created_at', { ascending: false })
        .limit(3);

      // 댓글 작성자 프로필 조회
      const commentUserIds = comments?.map(c => c.user_id) || [];
      let commentProfiles: Record<string, { username: string; display_name: string | null }> = {};
      
      if (commentUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', commentUserIds);
        
        profiles?.forEach(p => {
          commentProfiles[p.id] = { username: p.username, display_name: p.display_name };
        });
      }

      // 활동 통합 및 정렬
      const activities: Array<{
        type: string;
        message: string;
        created_at: string;
        icon: string;
      }> = [];

      transactions?.forEach(tx => {
        const username = tx.profiles?.display_name || tx.profiles?.username || 'Unknown';
        if (tx.transaction_type === 'buy') {
          activities.push({
            type: 'purchase',
            message: `${username} purchased ${tx.amount} token(s).`,
            created_at: tx.created_at,
            icon: 'cart'
          });
        } else {
          activities.push({
            type: 'sale',
            message: `${username} sold ${tx.amount} token(s).`,
            created_at: tx.created_at,
            icon: 'sale'
          });
        }
      });

      comments?.forEach(comment => {
        const profile = commentProfiles[comment.user_id];
        const username = profile?.display_name || profile?.username || 'Unknown';
        activities.push({
          type: 'comment',
          message: `${username} left a comment.`,
          created_at: comment.created_at,
          icon: 'comment'
        });
      });

      // 가격 돌파 이벤트 (예시)
      if (tokenInfo.currentPrice >= 50) {
        activities.push({
          type: 'milestone',
          message: `Price broke through $50! 🚀`,
          created_at: new Date().toISOString(),
          icon: 'rocket'
        });
      }

      return activities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 5);
    },
    enabled: !!selectedEntry?.id,
    staleTime: 1000 * 60 * 2,
  });

  // 로딩 중 또는 인증되지 않은 경우
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // Owner가 아닌 경우 리다이렉트 - 모든 로딩이 완료된 후에만 체크
  useEffect(() => {
    if (!authLoading && !ownerLoading && !isLoadingEntries && user && !isOwner) {
      console.log('Redirecting: not an owner', { isOwner, ownedEntries });
      navigate('/');
    }
  }, [authLoading, ownerLoading, isLoadingEntries, user, isOwner, ownedEntries, navigate]);

  // 모든 로딩 상태가 완료될 때까지 로딩 표시
  if (authLoading || ownerLoading || isLoadingEntries) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-20 pb-24">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </main>
      </div>
    );
  }

  if (!user || !isOwner) {
    return null;
  }

  const displayName = profile?.display_name || profile?.username || 'Master';
  const pageName = selectedEntry?.title || 'Your Page';

  const getActivityIcon = (iconType: string) => {
    switch (iconType) {
      case 'cart': return <ShoppingCart className="w-4 h-4 text-green-500" />;
      case 'sale': return <DollarSign className="w-4 h-4 text-yellow-500" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'rocket': return <Rocket className="w-4 h-4 text-primary" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleCashOut = () => {
    navigate('/earn?tab=tokens');
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Owner Dashboard - KTRENDZ</title>
        <meta name="description" content="Manage your fan pages and track performance" />
      </Helmet>
      
      <Navbar />
      
      <main className="container mx-auto px-4 pt-20 pb-24">
        {/* Dashboard Header */}
        <div className="mb-8 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">
                  Welcome, <span className="text-primary">{displayName}</span>
                </h1>
                <p className="text-muted-foreground">
                  <Link to={`/w/${selectedEntry?.slug}`} className="text-primary hover:underline font-medium">
                    {pageName}
                  </Link> is growing! 📈
                </p>
              </div>
            </div>

            {/* Page Selector Dropdown - 여러 페이지 운영시만 표시 */}
            {ownedEntries.length > 1 && (
              <Select
                value={selectedEntryIndex.toString()}
                onValueChange={(value) => setSelectedEntryIndex(parseInt(value))}
              >
                <SelectTrigger className="w-[180px] rounded-full">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {ownedEntries.map((entry, index) => (
                    <SelectItem key={entry.id} value={index.toString()}>
                      {entry.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Section 1: Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Support Fund Card */}
          {selectedEntry?.id && (
            <SupportFundCard wikiEntryId={selectedEntry.id} variant="full" />
          )}
          {/* Accumulated Fees */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-yellow-500/10 rounded-full">
                  <DollarSign className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">💰 Accumulated Fees</p>
              <p className="text-3xl font-bold mb-4">
                ${isLoadingFees ? '...' : accumulatedFees.toFixed(2)}
              </p>
              <Button 
                className="w-full rounded-full" 
                variant="outline"
                onClick={handleCashOut}
              >
                Cash Out
              </Button>
            </CardContent>
          </Card>

          {/* Lightstick Price */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">📈 Lightstick Price</p>
              <p className="text-3xl font-bold mb-4">
                ${isLoadingTokenInfo ? '...' : tokenInfo.currentPrice.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Supply: {userHeldSupply}
              </p>
            </CardContent>
          </Card>

          {/* My Holdings Value */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <Gem className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">💎 My Holdings Value</p>
              <p className="text-3xl font-bold mb-2">
                ${isLoadingTokenInfo ? '...' : tokenInfo.myValue.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Holdings: {tokenInfo.myBalance}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Split View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Holders */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Top Holders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHolders ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : topHolders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No holders yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {topHolders.map((holder: any, index: number) => (
                    <div 
                      key={holder.user_id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={holder.profiles?.avatar_url} />
                          <AvatarFallback>
                            {(holder.profiles?.display_name || holder.profiles?.username || 'U').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {holder.profiles?.display_name || holder.profiles?.username || 'Unknown'}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {holder.balance}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No recent activity.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="p-2 bg-background rounded-full shrink-0">
                        {getActivityIcon(activity.icon)}
                      </div>
                      <p className="text-sm leading-relaxed">
                        {activity.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default OwnerDashboard;
