// deno.land 대신 Deno.serve 사용
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const log = (message: string, data?: any) => {
  console.log(`[get-bot-trading-activity] ${message}`, data ? JSON.stringify(data) : '');
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 20, days = 7 } = await req.json().catch(() => ({}));

    log("Fetching bot trading activity from DB", { limit, days });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 지정 기간 내 완료된 거래 조회
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: transactions, error: txError } = await supabase
      .from("bot_transactions")
      .select("*")
      .gte("created_at", sinceDate.toISOString())
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    log("Raw transactions fetched", { count: transactions?.length || 0 });

    // fanz_token_id 목록으로 토큰 정보 조회
    const tokenIds = [...new Set((transactions || []).map((tx: any) => tx.fanz_token_id).filter(Boolean))];
    
    let tokenMap: Record<string, { token_id: string; title: string }> = {};
    
    if (tokenIds.length > 0) {
      const { data: tokens } = await supabase
        .from("fanz_tokens")
        .select(`
          id,
          token_id,
          wiki_entry:wiki_entries!fanz_tokens_wiki_entry_id_fkey (
            title
          )
        `)
        .in("id", tokenIds);

      for (const token of tokens || []) {
        const wikiEntry = token.wiki_entry as unknown as { title: string } | null;
        tokenMap[token.id] = {
          token_id: token.token_id,
          title: wikiEntry?.title || "Unknown",
        };
      }
    }

    // 에이전트 정보 조회
    const agentIds = [...new Set((transactions || []).map((tx: any) => tx.agent_id).filter(Boolean))];
    let agentMap: Record<string, string> = {};
    
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from("bot_agents")
        .select("id, name")
        .in("id", agentIds);

      for (const agent of agents || []) {
        agentMap[agent.id] = agent.name;
      }
    }

    // 트랜잭션 포맷팅
    const formattedTransactions = (transactions || []).map((tx: any) => {
      const tokenInfo = tokenMap[tx.fanz_token_id] || { token_id: "", title: "Unknown" };
      
      return {
        type: tx.transaction_type as "buy" | "sell",
        tokenId: tokenInfo.token_id,
        artistName: tokenInfo.title,
        agentName: agentMap[tx.agent_id] || "Unknown Agent",
        buyer: tx.transaction_type === "buy" ? tx.agent_id : undefined,
        seller: tx.transaction_type === "sell" ? tx.agent_id : undefined,
        amount: tx.amount,
        totalCost: tx.transaction_type === "buy" ? tx.total_cost_usdc : undefined,
        refund: tx.transaction_type === "sell" ? tx.total_cost_usdc : undefined,
        txHash: tx.tx_hash,
        timestamp: Math.floor(new Date(tx.created_at).getTime() / 1000),
      };
    });

    // 통계 계산
    const allTx = transactions || [];
    const buys = allTx.filter((tx: any) => tx.transaction_type === "buy");
    const sells = allTx.filter((tx: any) => tx.transaction_type === "sell");

    const stats = {
      totalBuys: buys.length,
      totalSells: sells.length,
      totalVolume: allTx.reduce((sum: number, tx: any) => sum + (tx.total_cost_usdc || 0), 0),
      mostTradedToken: getMostTradedToken(formattedTransactions),
      uniqueTraders: new Set(allTx.map((tx: any) => tx.agent_id)).size,
    };

    log("Activity processed", {
      transactionCount: formattedTransactions.length,
      stats,
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactions: formattedTransactions,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("Error", { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function getMostTradedToken(transactions: any[]): { tokenId: string; artistName: string; count: number } | null {
  const counts: Record<string, { artistName: string; count: number }> = {};

  for (const tx of transactions) {
    if (!counts[tx.tokenId]) {
      counts[tx.tokenId] = { artistName: tx.artistName, count: 0 };
    }
    counts[tx.tokenId].count += tx.amount;
  }

  let max: { tokenId: string; artistName: string; count: number } | null = null;
  for (const [tokenId, data] of Object.entries(counts)) {
    if (!max || data.count > max.count) {
      max = { tokenId, ...data };
    }
  }

  return max;
}
