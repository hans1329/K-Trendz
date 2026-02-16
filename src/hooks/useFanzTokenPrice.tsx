import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const USDC_DECIMALS = 6;

// Edge Function을 통해 온체인 데이터 조회 (Alchemy RPC 사용)
interface OnchainPriceResponse {
  success: boolean;
  data?: {
    tokenId: string;  // string으로 변경 (큰 숫자 overflow 방지)
    amount: number;
    buyCost: number;
    buyCostUsd: number;
    reserveCostUsd: number;       // V4: 정확한 Reserve (70%)
    artistFundFeeUsd: number;     // V4: 정확한 Artist Fund (20%)
    platformFeeUsd: number;       // V4: 정확한 Platform (10%)
    sellReturn: number;
    sellGrossRefund: number;      // V4: 판매시 총 환불액 (Reserve)
    sellPlatformFee: number;      // V4: 판매시 플랫폼 수수료 (4%)
    sellNetRefund: number;        // V4: 판매시 순 환불액 (96%)
    totalSupply: number;
    basePrice: number;
    kValue: number;
    isOnchainData: boolean;
    isTokenRegistered: boolean;
  };
  error?: string;
  fallback?: boolean;
}

async function fetchOnchainPrice(tokenId: string): Promise<OnchainPriceResponse | null> {
  try {
    // tokenId를 string으로 전달 (JavaScript에서 큰 숫자 overflow 방지)
    // V2 컨트랙트만 사용하므로 contractAddress 전달 불필요
    const { data, error } = await supabase.functions.invoke('get-fanztoken-price', {
      body: { tokenId, amount: 1 }
    });
    
    if (error) {
      console.warn("Edge function error:", error.message);
      return null;
    }
    
    return data as OnchainPriceResponse;
  } catch (error) {
    console.warn("Failed to fetch onchain price:", error);
    return null;
  }
}

// 수수료 모델 (v2): 
// 구매: 표시가격 100% = 리저브 70% + 아티스트펀드 20% + 플랫폼 10%
// 판매: 리저브 100% 환불 (수수료 없음)
export const RESERVE_PERCENT = 0.70;           // 본딩커브 리저브
export const COMMUNITY_FUND_PERCENT = 0.20;    // 아티스트 펀드 (20%)
export const PLATFORM_FEE_PERCENT = 0.10;      // 플랫폼 수수료 (10%)

// 커뮤니티 펀드가 적립되기 시작하는 최소 공급량
export const COMMUNITY_FUND_MIN_SUPPLY = 100;

// Stripe 수수료 계산 함수 (2.9% + $0.30)
export const calculateStripeTotal = (netAmount: number): number => {
  const STRIPE_FIXED_FEE = 0.30;
  const STRIPE_PERCENT_FEE = 0.029;
  return (netAmount + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENT_FEE);
};

// 표시 가격 계산: (본딩커브 / 0.7) + Stripe 수수료
// 사용자에게 보여주는 최종 가격에 Stripe 수수료 포함
export const calculateDisplayPrice = (bondingCurvePrice: number): number => {
  const baseDisplayPrice = bondingCurvePrice / RESERVE_PERCENT;
  return calculateStripeTotal(baseDisplayPrice);
};

/**
 * 공통 가격 조회 함수: get-fanztoken-price Edge Function을 호출하여
 * Stripe 수수료 포함 최종 표시 가격을 반환합니다.
 * 
 * 모든 페이지에서 이 함수를 사용하여 가격을 계산해야 합니다.
 * (useFanzTokenPrice 훅의 priceWithStripeUSD와 동일한 값)
 * 
 * @param tokenId - 온체인 토큰 ID (string)
 * @returns Stripe 수수료 포함 표시 가격 (USD), 실패 시 0
 */
export const fetchTokenDisplayPrice = async (tokenId: string): Promise<number> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-fanztoken-price', {
      body: { tokenId, amount: 1 }
    });
    if (error || !data?.success || !data?.data?.isOnchainData) return 0;
    const buyCostUsd = data.data.buyCost ?? 0;
    return buyCostUsd > 0 ? Math.max(calculateStripeTotal(buyCostUsd), 0.50) : 0;
  } catch {
    return 0;
  }
};

/**
 * 공통 가격 조회 (상세): get-fanztoken-price Edge Function의 원시 응답을 반환합니다.
 * buyCost, totalSupply 등 추가 정보가 필요한 경우 사용합니다.
 */
export const fetchTokenPriceData = async (tokenId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('get-fanztoken-price', {
      body: { tokenId, amount: 1 }
    });
    if (error || !data?.success) return null;
    return data.data as {
      buyCost: number;
      buyCostUsd: number;
      totalSupply: number;
      isOnchainData: boolean;
      isTokenRegistered: boolean;
      reserveCostUsd: number;
      artistFundFeeUsd: number;
      platformFeeUsd: number;
      sellGrossRefund: number;
      sellPlatformFee: number;
      sellNetRefund: number;
    } | null;
  } catch {
    return null;
  }
};


interface FanzTokenPriceResult {
  buyCostUsd: number | null;           // 온체인 본딩커브 비용 (null = 데이터 없음)
  priceInUSD: number | null;           // 표시 가격 (Stripe 수수료 포함, null = 데이터 없음)
  priceWithStripeUSD: number | null;   // 레거시 호환 (= priceInUSD)
  priceWithFundUSD: number | null;     // 레거시 호환 (= priceInUSD)
  communityFundAmount: number | null;  // 아티스트 펀드 금액 (20%)
  platformFeeAmount: number | null;    // 플랫폼 수수료 금액 (10%)
  reserveAmount: number | null;        // 리저브 금액 (70%)
  isCommunityFundActive: boolean; // 실제 적립 여부 (100개 이상일 때만 true)
  sellRefundUsd: number | null;        // 판매시 받는 금액 (null = 데이터 없음)
  totalSupply: number | null;
  userHeldSupply: number;
  isLoading: boolean;
  isError: boolean;
  isOnchainDataAvailable: boolean;    // 온체인 데이터 성공 여부
}

export const useFanzTokenPrice = (wikiEntryId: string | undefined): FanzTokenPriceResult => {
  // 토큰 정보 조회
  const { data: fanzToken, isLoading: isLoadingToken } = useQuery({
    queryKey: ['fanz-token', wikiEntryId],
    queryFn: async () => {
      if (!wikiEntryId) return null;
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select('*')
        .eq('wiki_entry_id', wikiEntryId)
        .eq('is_active', true)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 30000,
  });

  // Edge Function을 통해 온체인 가격 조회 (Alchemy RPC 사용) - DB 폴백 없음
  const { data: onchainData, isLoading: isLoadingOnchain, isError } = useQuery({
    queryKey: ['fanz-token-onchain-price', fanzToken?.id, fanzToken?.token_id],
    queryFn: async () => {
      if (!fanzToken?.token_id) return null;

      // Edge Function으로 온체인 데이터 조회 (Alchemy RPC)
      const response = await fetchOnchainPrice(fanzToken.token_id);

      if (response?.success && response.data?.isOnchainData && response.data?.isTokenRegistered) {
        // 온체인 데이터 성공 - V4 API의 정확한 분리 값 사용
        console.log("✅ On-chain price via Alchemy RPC:", {
          tokenId: fanzToken.token_id,
          buyCost: response.data.buyCost,
          reserveCostUsd: response.data.reserveCostUsd,
          artistFundFeeUsd: response.data.artistFundFeeUsd,
          platformFeeUsd: response.data.platformFeeUsd,
          totalSupply: response.data.totalSupply,
          sellGrossRefund: response.data.sellGrossRefund,
          sellNetRefund: response.data.sellNetRefund,
        });
        return {
          buyCostUsd: response.data.buyCost,
          reserveCostUsd: response.data.reserveCostUsd,
          artistFundFeeUsd: response.data.artistFundFeeUsd,
          platformFeeUsd: response.data.platformFeeUsd,
          totalSupply: response.data.totalSupply,
          sellGrossRefund: response.data.sellGrossRefund,
          sellNetRefund: response.data.sellNetRefund,
          userHeldSupply: 0,
          isOnchainDataAvailable: true,
        };
      } else {
        // 온체인 데이터 없음 - DB 폴백 사용 안 함
        console.warn("❌ On-chain data unavailable, no fallback used", {
          tokenId: fanzToken.token_id,
          response,
        });
        return {
          buyCostUsd: null,
          reserveCostUsd: null,
          artistFundFeeUsd: null,
          platformFeeUsd: null,
          totalSupply: null,
          sellGrossRefund: null,
          sellNetRefund: null,
          userHeldSupply: 0,
          isOnchainDataAvailable: false,
        };
      }
    },
    enabled: !!fanzToken?.token_id,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const isLoading = isLoadingToken || isLoadingOnchain;

  // 온체인 데이터가 없거나 실패한 경우 - null 반환 (UI에서 '-' 표시)
  if (!onchainData || !onchainData.isOnchainDataAvailable) {
    return {
      buyCostUsd: null,
      priceInUSD: null,
      priceWithStripeUSD: null,
      priceWithFundUSD: null,
      communityFundAmount: null,
      platformFeeAmount: null,
      reserveAmount: null,
      isCommunityFundActive: false,
      sellRefundUsd: null,
      totalSupply: null,
      userHeldSupply: 0,
      isLoading,
      isError: isError || !onchainData?.isOnchainDataAvailable,
      isOnchainDataAvailable: false,
    };
  }

  // 온체인 데이터가 있는 경우
  // V4 컨트랙트: API에서 정확한 분리 값 사용
  const totalSupply = onchainData.totalSupply!;
  const buyCostWithFees = onchainData.buyCostUsd!;
  
  // Stripe 수수료만 추가 (30% 수수료는 이미 온체인에 포함됨)
  const priceInUSD = Math.max(calculateStripeTotal(buyCostWithFees), 0.50);
  
  // V4: API에서 반환한 정확한 분리 값 사용 (역산 아님)
  const reserveAmount = onchainData.reserveCostUsd!;
  const communityFundAmount = onchainData.artistFundFeeUsd!;
  const platformFeeAmount = onchainData.platformFeeUsd!;
  
  // 판매시 환불액: V4 API의 sellNetRefund 사용 (4% 수수료 차감된 순 환불액)
  const sellRefundUsd = onchainData.sellNetRefund ?? reserveAmount * 0.96;
  
  // 실제 펀드 적립은 100개 이상일 때만
  const isCommunityFundActive = totalSupply >= COMMUNITY_FUND_MIN_SUPPLY;

  return {
    buyCostUsd: buyCostWithFees,
    priceInUSD,
    priceWithStripeUSD: priceInUSD, // 레거시 호환 (이미 Stripe 포함)
    priceWithFundUSD: priceInUSD,   // 레거시 호환
    communityFundAmount,
    platformFeeAmount,
    reserveAmount,
    isCommunityFundActive,
    sellRefundUsd,
    totalSupply,
    userHeldSupply: onchainData.userHeldSupply,
    isLoading,
    isError: false,
    isOnchainDataAvailable: true,
  };
};
