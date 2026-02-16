import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublicBalancesRequest {
  userId: string;
}

interface PublicBalanceItem {
  tokenId: string;
  balance: number;
  wikiEntryId: string | null;
  wikiEntryTitle: string | null;
  wikiEntryImage: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<PublicBalancesRequest>;
    const userId = body.userId;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ balances: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 사용자 지갑 주소는 민감정보이므로 클라이언트로 직접 노출하지 않는다.
    // 대신 서비스 롤로 조회 후, "공개 가능한 결과(토큰 잔액 + 위키 메타)"만 반환한다.
    //
    // NOTE: Edge Function 간 호출 시 `apikey`는 "anon key"를 사용해야 안정적으로 동작한다.
    // (service role key는 Authorization으로만 사용)
    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM";

    // DB 스냅샷 우선
    // - 타인 프로필의 "보유 응원봉"은 UX적으로 실시간 온체인보다 "안 보이는" 문제가 더 치명적이다.
    // - RPC rate limit(429) 시에도 DB에 기록된 보유분은 노출되도록 한다.
    const fetchDbBalances = async (): Promise<PublicBalanceItem[]> => {
      try {
        const { data, error } = await supabaseAdmin
          .from("fanz_balances")
          .select(
            `
            balance,
            fanz_tokens!fanz_balances_fanz_token_id_fkey (
              token_id,
              wiki_entry_id,
              wiki_entries!fanz_tokens_wiki_entry_id_fkey (
                id,
                title,
                image_url
              )
            )
          `
          )
          .eq("user_id", userId)
          .gt("balance", 0)
          .limit(200);

        if (error || !data) return [];

        return (data as any[])
          .map((row) => {
            const token = row?.fanz_tokens;
            const wiki = token?.wiki_entries;
            const tokenId = token?.token_id;
            if (!tokenId) return null;

            return {
              tokenId: String(tokenId),
              balance: Number(row?.balance ?? 0),
              wikiEntryId: wiki?.id ?? token?.wiki_entry_id ?? null,
              wikiEntryTitle: wiki?.title ?? null,
              wikiEntryImage: wiki?.image_url ?? null,
            } as PublicBalanceItem;
          })
          .filter(Boolean) as PublicBalanceItem[];
      } catch (e) {
        console.error("get-public-user-fanz-balances db fallback error:", e);
        return [];
      }
    };

    const dbBalances = await fetchDbBalances();
    if (dbBalances.length > 0) {
      return new Response(JSON.stringify({ balances: dbBalances }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wallets } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address, wallet_type")
      .eq("user_id", userId)
      .limit(50);

    const primaryWallet =
      wallets?.find((w: any) => w.wallet_type === "smart_wallet")?.wallet_address ??
      wallets?.[0]?.wallet_address;

    if (!primaryWallet) {
      return new Response(JSON.stringify({ balances: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 기존 온체인 조회 함수 재사용 (후보 주소 확장 로직 포함)
    const balancesRes = await fetch(`${supabaseUrl}/functions/v1/get-user-fanz-balances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        walletAddress: primaryWallet,
        userId,
        includeMeta: false,
      }),
    });

    const balancesJson = await balancesRes
      .json()
      .catch(() => ({ balances: [] }));

    const rawBalances = Array.isArray(balancesJson?.balances)
      ? balancesJson.balances
      : [];

    const positive = rawBalances
      .map((b: any) => ({ tokenId: String(b.tokenId), balance: Number(b.balance ?? 0) }))
      .filter((b: any) => b.balance > 0);

    if (positive.length === 0) {
      return new Response(JSON.stringify({ balances: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenIds = positive.map((b: any) => b.tokenId);

    const { data: tokenMeta } = await supabaseAdmin
      .from("fanz_tokens")
      .select(
        `
        token_id,
        wiki_entry_id,
        wiki_entries!fanz_tokens_wiki_entry_id_fkey (
          id,
          title,
          image_url
        )
      `
      )
      .in("token_id", tokenIds)
      .limit(200);

    const metaByTokenId = new Map<string, any>();
    for (const row of (tokenMeta ?? []) as any[]) {
      metaByTokenId.set(String(row.token_id), row);
    }

    const result: PublicBalanceItem[] = positive.map((b: any) => {
      const meta = metaByTokenId.get(String(b.tokenId));
      const wiki = meta?.wiki_entries;
      return {
        tokenId: String(b.tokenId),
        balance: Number(b.balance),
        wikiEntryId: wiki?.id ?? null,
        wikiEntryTitle: wiki?.title ?? null,
        wikiEntryImage: wiki?.image_url ?? null,
      };
    });

    return new Response(JSON.stringify({ balances: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-public-user-fanz-balances error:", e);
    return new Response(JSON.stringify({ balances: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
