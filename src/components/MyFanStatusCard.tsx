import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, Wand2, Crown, Star, Gem, ChevronDown } from "lucide-react";
import { ethers } from "ethers";
import { useFanzTokenPrice } from "@/hooks/useFanzTokenPrice";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


// FanzToken 컨트랙트 상수
const FANZTOKEN_ABI = ["function balanceOf(address account, uint256 id) external view returns (uint256)"];
const FANZTOKEN_CONTRACT_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7"; // V5 컨트랙트
interface MyFanStatusCardProps {
  wikiEntryId: string;
  userId: string | null;
  userProfile: {
    avatar_url?: string | null;
    display_name?: string | null;
    username?: string;
  } | null;
  ownerId?: string | null;
}

// 응원봉 보유 수량에 따른 계급 정의
const getLightstickRank = (count: number) => {
  if (count >= 100) return {
    name: "Diamond Fan",
    icon: Gem,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20"
  };
  if (count >= 50) return {
    name: "Gold Fan",
    icon: Crown,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20"
  };
  if (count >= 20) return {
    name: "Silver Fan",
    icon: Star,
    color: "text-gray-300",
    bgColor: "bg-gray-400/20"
  };
  if (count >= 5) return {
    name: "Bronze Fan",
    icon: Wand2,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20"
  };
  return {
    name: "Lightstick Holder",
    icon: Wand2,
    color: "text-primary",
    bgColor: "bg-primary/20"
  };
};
const MyFanStatusCard = ({
  wikiEntryId,
  userId,
  userProfile,
  ownerId
}: MyFanStatusCardProps) => {
  // 팔로우 상태 확인
  const {
    data: isFollowing
  } = useQuery({
    queryKey: ['wiki-entry-follow', wikiEntryId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const {
        data,
        error
      } = await supabase.from('wiki_entry_followers').select('id').eq('wiki_entry_id', wikiEntryId).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId
  });

  // Fanz Token 가격 정보
  const {
    priceInUSD,
    isLoading: isPriceLoading
  } = useFanzTokenPrice(wikiEntryId);

  // Fanz Token 정보
  const {
    data: fanzToken
  } = useQuery({
    queryKey: ['fanz-token', wikiEntryId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('fanz_tokens').select('*').eq('wiki_entry_id', wikiEntryId).eq('is_active', true).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!wikiEntryId
  });

  // 사용자 지갑 주소 조회
  const {
    data: userWallet
  } = useQuery({
    queryKey: ['user-wallet', userId],
    queryFn: async () => {
      if (!userId) return null;
      const {
        data,
        error
      } = await supabase.from('wallet_addresses').select('wallet_address').eq('user_id', userId).eq('network', 'base').maybeSingle();
      if (error) throw error;
      return data?.wallet_address;
    },
    enabled: !!userId
  });

  // 온체인 토큰 보유량 조회
  const {
    data: tokenBalance,
    isLoading: isBalanceLoading
  } = useQuery({
    queryKey: ['user-fanz-balance', fanzToken?.token_id, userWallet],
    queryFn: async () => {
      if (!fanzToken?.token_id || !userWallet) return 0;
      try {
        // Alchemy RPC 사용 - staticNetwork로 네트워크 감지 스킵 (무한 재시도 방지)
        const rpcUrl = "https://base-mainnet.g.alchemy.com/v2/lQ8d0CvmXnkOFaDOywREJnUr4kCEE3n1";
        const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: 8453, name: 'base' }, { staticNetwork: true });
        const contract = new ethers.Contract(FANZTOKEN_CONTRACT_ADDRESS, FANZTOKEN_ABI, provider);
        const tokenIdBigInt = BigInt(fanzToken.token_id);
        const balance = await contract.balanceOf(userWallet, tokenIdBigInt);
        return Number(balance);
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return 0;
      }
    },
    enabled: !!fanzToken?.token_id && !!userWallet,
    staleTime: 30000
  });

  // 로그인하지 않은 경우 표시 안함
  if (!userId || !userProfile) {
    return null;
  }

  // 계급 결정 (Master가 최우선)
  const balance = tokenBalance || 0;
  let rank: {
    name: string;
    icon: React.ComponentType<any>;
    color: string;
    bgColor: string;
  };
  if (userId && ownerId && userId === ownerId) {
    rank = {
      name: "Captain",
      icon: Crown,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20"
    };
  } else if (balance > 0) {
    rank = getLightstickRank(balance);
  } else if (isFollowing) {
    rank = {
      name: "Follower",
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20"
    };
  } else {
    rank = {
      name: "Visitor",
      icon: Eye,
      color: "text-muted-foreground",
      bgColor: "bg-muted"
    };
  }
  const RankIcon = rank.icon;
  const assetValue = balance * priceInUSD;
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-2xl bg-gradient-to-r from-muted/30 to-muted/10 border border-border/30">
      {/* 프로필 사진 */}
      <Avatar className="w-9 h-9 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
        <AvatarImage src={userProfile.avatar_url || undefined} />
        <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
          {(userProfile.display_name || userProfile.username || 'U')[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* 계급 및 이름 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate mb-0.5">
          {userProfile.display_name || userProfile.username}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 hover:opacity-80 transition-opacity group">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${rank.bgColor}`}>
                <RankIcon className={`w-3 h-3 ${rank.color}`} />
                <span className={`text-xs font-medium ${rank.color}`}>{rank.name}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Fan Rank System</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-muted-foreground">Master</span>
                  <span className="ml-auto text-foreground">Owner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gem className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-muted-foreground">Diamond Fan</span>
                  <span className="ml-auto text-foreground">100+</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-muted-foreground">Gold Fan</span>
                  <span className="ml-auto text-foreground">50+</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-muted-foreground">Silver Fan</span>
                  <span className="ml-auto text-foreground">20+</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-muted-foreground">Bronze Fan</span>
                  <span className="ml-auto text-foreground">5+</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-muted-foreground">Lightstick Holder</span>
                  <span className="ml-auto text-foreground">1+</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-muted-foreground">Follower</span>
                  <span className="ml-auto text-foreground">0</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Visitor</span>
                  <span className="ml-auto text-foreground">0</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 응원봉 보유량 및 자산가치 */}
      <div className="text-right flex flex-col items-end">
        <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">{isBalanceLoading ? '...' : balance}</span>
        </div>
        {balance > 0 && !isPriceLoading && (
          <span className="text-xs text-muted-foreground mt-1">
            ≈ ${assetValue.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
};
export default MyFanStatusCard;