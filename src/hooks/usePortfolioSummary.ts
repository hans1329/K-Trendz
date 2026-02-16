import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchTokenDisplayPrice } from "@/hooks/useFanzTokenPrice";

export type PortfolioHolding = {
  id: string;
  name: string;
  image_url: string | null;
};

export type PortfolioSummary = {
  balances: Array<{
    tokenId: string;
    balance: number;
    priceUsd?: number;
  }>;
  totalValue: number;
  totalCost: number;
  totalChange: number;
  holdings: PortfolioHolding[];
};

const emptyPortfolio: PortfolioSummary = {
  balances: [],
  totalValue: 0,
  totalCost: 0,
  totalChange: 0,
  holdings: [],
};

// 홈(/v2)에서 쓰는 "My Portfolio" 요약 데이터
export const usePortfolioSummary = (userId: string | null) => {
  return useQuery({
    queryKey: ["portfolio-summary", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PortfolioSummary> => {
      if (!userId) return emptyPortfolio;

      const { data, error } = await supabase.functions.invoke("get-user-fanz-balances", {
        body: { userId },
      });

      if (error) {
        console.warn("[get-user-fanz-balances] portfolio fallback:", error);
        return emptyPortfolio;
      }

      const balancesRaw = (data?.balances ?? []) as any[];
      const balances = balancesRaw.map((b) => ({
        tokenId: String(b.tokenId),
        balance: Number(b.balance ?? 0),
        priceUsd: b.priceUsd != null ? Number(b.priceUsd) : undefined,
      }));

      const owned = balances.filter((b) => b.balance > 0);
      if (owned.length === 0) return { ...emptyPortfolio, balances };

      // 보유 토큰의 메타(이름/이미지)만 DB에서 보강
      const tokenIds = owned.map((b) => b.tokenId);
      const { data: tokenRows, error: tokenErr } = await supabase
        .from("fanz_tokens")
        .select(
          `id, token_id,
           wiki_entries:wiki_entry_id (title, image_url),
           posts:post_id (title, image_url)`
        )
        .in("token_id", tokenIds)
        .limit(200);

      if (tokenErr) {
        console.warn("[portfolio] failed to load token metadata:", tokenErr);
      }

      const tokenIdToDbId = new Map<string, string>();
      const metaByTokenId = new Map<string, PortfolioHolding>();
      (tokenRows ?? []).forEach((row: any) => {
        const name = row?.wiki_entries?.title ?? row?.posts?.title ?? "Token";
        const image_url = row?.wiki_entries?.image_url ?? row?.posts?.image_url ?? null;
        tokenIdToDbId.set(String(row.token_id), String(row.id));
        metaByTokenId.set(String(row.token_id), { id: String(row.id), name, image_url });
      });

      const holdings: PortfolioHolding[] = owned
        .map((b) => metaByTokenId.get(b.tokenId))
        .filter(Boolean) as PortfolioHolding[];

      // 공통 가격 함수(fetchTokenDisplayPrice)로 가격 조회 - 엔트리 페이지와 동일한 값
      const prices = await Promise.all(owned.map((b) => fetchTokenDisplayPrice(b.tokenId)));

      const totalValue = owned.reduce((sum, b, i) => sum + b.balance * prices[i], 0);

      // 매입 비용 계산
      const dbIds = owned.map((b) => tokenIdToDbId.get(b.tokenId)).filter(Boolean) as string[];
      let totalCost = 0;

      if (dbIds.length > 0) {
        const { data: txData } = await supabase
          .from("fanz_transactions")
          .select("fanz_token_id, amount, total_value, transaction_type")
          .eq("user_id", userId)
          .in("fanz_token_id", dbIds);

        if (txData && txData.length > 0) {
          const costByTokenId = new Map<string, number>();
          txData.forEach((tx) => {
            const currentCost = costByTokenId.get(tx.fanz_token_id) || 0;
            if (tx.transaction_type === "buy") {
              costByTokenId.set(tx.fanz_token_id, currentCost + Number(tx.total_value));
            } else if (tx.transaction_type === "sell") {
              costByTokenId.set(tx.fanz_token_id, currentCost - Number(tx.total_value));
            }
          });
          totalCost = Array.from(costByTokenId.values()).reduce((sum, cost) => sum + Math.max(cost, 0), 0);
        }
      }

      const totalChange = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

      return { balances, totalValue, totalCost, totalChange, holdings };
    },
  });
};
