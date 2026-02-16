import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateStripeTotal } from "@/hooks/useFanzTokenPrice";

export interface HotTokenItem {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  metadata: any;
  follower_count: number;
  current_price: number;
  price_change: number;
  total_supply: number;
  community_fund: number;
  token_id?: string;           // 온체인 token_id (string)
  fanz_token_db_id?: string;   // fanz_tokens 테이블의 UUID
  raw_buy_cost?: number;       // Stripe 수수료 제외한 온체인 가격 (BuyDialog용)
}

export type SortBy = 'trending' | 'price_asc' | 'price_desc';

interface UseHotTokensOptions {
  limit?: number;
  sortBy?: SortBy;
}

/**
 * Hot Artists / Trending Now / Discover 섹션에서 사용하는 공통 데이터 훅
 * Rankings 티커와 동일한 24시간 기준 가격 변동 로직 사용
 */
export const useHotTokensData = (options: UseHotTokensOptions | number = 10) => {
  // 하위 호환성: 숫자만 전달하면 limit으로 처리
  const { limit = 10, sortBy = 'trending' } = typeof options === 'number' 
    ? { limit: options, sortBy: 'trending' as SortBy } 
    : options;

  return useQuery({
    queryKey: ['hot-tokens-unified', limit, sortBy],
    queryFn: async (): Promise<HotTokenItem[]> => {
      // 오늘 0시 (UTC 기준)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 1. fanz_tokens가 있는 아티스트만 조회
      // sortBy에 따라 초기 정렬 기준 결정 (가격 정렬은 온체인 조회 후 클라이언트에서)
      let query = supabase
        .from('wiki_entries')
        .select(`
          id, title, slug, image_url, metadata, trending_score, follower_count,
          fanz_tokens!inner (id, token_id, total_supply, base_price, k_value),
          entry_community_funds (total_fund)
        `)
        .in('schema_type', ['artist', 'member'])
        .not('content', 'is', null);

      // 가격 정렬 시에는 더 많은 데이터를 가져와서 클라이언트에서 정렬
      if (sortBy === 'price_asc' || sortBy === 'price_desc') {
        query = query.order('total_supply', { referencedTable: 'fanz_tokens', ascending: true }).limit(limit);
      } else {
        query = query.order('trending_score', { ascending: false }).limit(limit);
      }

      const { data: entries, error: entriesError } = await query;

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) return [];

      // 2. 오늘 첫 거래 가격 조회 (UTC 00:00 이후)
      const tokenIds = entries
        .map(e => e.fanz_tokens?.[0]?.id)
        .filter(Boolean) as string[];

      let todayFirstPriceMap = new Map<string, number>();
      
      if (tokenIds.length > 0) {
        const { data: todayTxs } = await supabase
          .from('fanz_transactions')
          .select('fanz_token_id, price_per_token, created_at')
          .in('fanz_token_id', tokenIds)
          .eq('transaction_type', 'buy')
          .gte('created_at', todayISO)
          .order('created_at', { ascending: true });

        if (todayTxs) {
          // 토큰별 첫 거래 가격만 추출
          todayTxs.forEach(tx => {
            if (!todayFirstPriceMap.has(tx.fanz_token_id)) {
              const price = Number(tx.price_per_token);
              if (Number.isFinite(price) && price > 0) {
                todayFirstPriceMap.set(tx.fanz_token_id, price);
              }
            }
          });
        }
      }

      // 3. 온체인 가격 병렬 조회
      const TIMEOUT_MS = 2500;
      const pricePromises = entries.map(async (entry) => {
        const token = entry.fanz_tokens?.[0];
        if (!token?.token_id) return null;

        try {
          const invokePromise = supabase.functions.invoke('get-fanztoken-price', {
            body: { tokenId: token.token_id, amount: 1 }
          });
          
          const result = await Promise.race([
            invokePromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
          ]) as any;

          if (!result) return null;
          const { data, error } = result;

          if (!error && data?.success && data?.data?.buyCost) {
            const buyCostUsd = Number(data.data.buyCost);
            const totalSupply = data.data.totalSupply ?? token.total_supply;
            if (Number.isFinite(buyCostUsd) && buyCostUsd > 0) {
              return {
                entryId: entry.id,
                price: calculateStripeTotal(buyCostUsd),
                rawBuyCost: buyCostUsd,  // Stripe 수수료 미포함 원가
                totalSupply,
              };
            }
          }
          return null;
        } catch {
          return null;
        }
      });

      const priceResults = await Promise.allSettled(pricePromises);
      const priceMap = new Map<string, { price: number; rawBuyCost: number; totalSupply: number }>();
      
      priceResults.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          priceMap.set(res.value.entryId, {
            price: res.value.price,
            rawBuyCost: res.value.rawBuyCost,
            totalSupply: res.value.totalSupply,
          });
        }
      });

      // 4. 최종 데이터 조합
      const mapped = entries.map((entry) => {
        const token = entry.fanz_tokens?.[0];
        const fundRel: any = entry.entry_community_funds;
        const communityFund = Array.isArray(fundRel)
          ? (fundRel[0]?.total_fund || 0)
          : (fundRel?.total_fund || 0);

        // 온체인 가격 우선, 없으면 DB 폴백
        const onchainData = priceMap.get(entry.id);
        let currentPrice = 0.50;
        let rawBuyCost = 0.35;  // 기본값
        let totalSupply = token?.total_supply || 0;

        if (onchainData) {
          currentPrice = Math.max(onchainData.price, 0.50);
          rawBuyCost = onchainData.rawBuyCost;
          totalSupply = onchainData.totalSupply;
        } else if (token) {
          // DB 폴백: 본딩커브 계산
          const kValueScaled = token.k_value / 1e12;
          const bondingPrice = token.base_price + (kValueScaled * Math.sqrt(token.total_supply));
          rawBuyCost = bondingPrice;
          currentPrice = Math.max(calculateStripeTotal(bondingPrice), 0.50);
        }

        // 24시간 가격 변동률 계산 (Rankings 티커와 동일 로직)
        const todayFirstPrice = token?.id ? todayFirstPriceMap.get(token.id) : null;
        let priceChange = 0;
        
        if (totalSupply > 0 && todayFirstPrice && todayFirstPrice > 0) {
          priceChange = ((currentPrice - todayFirstPrice) / todayFirstPrice) * 100;
          // 비정상적인 값 필터링
          if (!Number.isFinite(priceChange) || Math.abs(priceChange) > 1000) {
            priceChange = 0;
          }
        }

        return {
          id: entry.id,
          title: entry.title,
          slug: entry.slug,
          image_url: entry.image_url,
          metadata: entry.metadata,
          follower_count: (entry as any).follower_count || 0,
          current_price: currentPrice,
          price_change: priceChange,
          total_supply: totalSupply,
          community_fund: communityFund,
          token_id: token?.token_id,
          fanz_token_db_id: token?.id,
          raw_buy_cost: rawBuyCost,
        };
      });

      // 클라이언트 정렬
      if (sortBy === 'price_asc') {
        mapped.sort((a, b) => a.current_price - b.current_price);
      } else if (sortBy === 'price_desc') {
        mapped.sort((a, b) => b.current_price - a.current_price);
      }

      return mapped;
    },
    staleTime: 5 * 60 * 1000,    // 5분 캐싱
    gcTime: 10 * 60 * 1000,       // 10분 GC
    refetchInterval: 5 * 60 * 1000, // 5분마다 백그라운드 갱신
  });
};
