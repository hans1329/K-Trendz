import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// 온체인 공급량 조회 응답 타입
interface OnchainTokenResponse {
  totalSupply: string;
  basePrice: number;
  kValue: number;
  creator: string;
  buyCostUsd: number;
  buyCostRaw: string;
}

// 온체인 토큰 공급량 조회 함수
async function fetchOnchainSupply(tokenId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.functions.invoke('check-onchain-token', {
      body: { tokenId }
    });
    
    if (error) {
      console.warn("Failed to fetch onchain supply:", error.message);
      return null;
    }
    
    const response = data as OnchainTokenResponse;
    return parseInt(response.totalSupply, 10);
  } catch (error) {
    console.warn("Error fetching onchain supply:", error);
    return null;
  }
}

interface UseOnchainSupplyResult {
  supply: number | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 온체인에서 토큰 공급량을 직접 조회하는 훅
 * DB의 total_supply 대신 블록체인에서 실제 값을 가져옴
 */
export const useOnchainSupply = (tokenId: string | undefined): UseOnchainSupplyResult => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['onchain-supply', tokenId],
    queryFn: async () => {
      if (!tokenId) return null;
      return fetchOnchainSupply(tokenId);
    },
    enabled: !!tokenId,
    staleTime: 10000,  // 10초간 캐시
    refetchInterval: 15000,  // 15초마다 자동 리프레시
  });

  return {
    supply: data ?? null,
    isLoading,
    isError,
    refetch,
  };
};

/**
 * 여러 토큰의 온체인 공급량을 일괄 조회하는 훅
 */
export const useOnchainSupplyBatch = (tokenIds: string[]): Map<string, number> => {
  const queries = useQuery({
    queryKey: ['onchain-supply-batch', tokenIds.join(',')],
    queryFn: async () => {
      const results = new Map<string, number>();
      
      // 병렬 조회
      const promises = tokenIds.map(async (tokenId) => {
        const supply = await fetchOnchainSupply(tokenId);
        if (supply !== null) {
          results.set(tokenId, supply);
        }
      });
      
      await Promise.all(promises);
      return results;
    },
    enabled: tokenIds.length > 0,
    staleTime: 10000,
  });

  return queries.data ?? new Map();
};
