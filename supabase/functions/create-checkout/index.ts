import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 크리에이터의 Tebex Wallet Reference 가져오기
async function getCreatorWalletRef(badgeId: string, wikiEntryId: string | undefined, supabase: any): Promise<string | undefined> {
  try {
    // 위키 엔트리에 뱃지를 부여하는 경우에만 크리에이터 정산
    if (!wikiEntryId) {
      console.log("No wiki_entry_id provided, skipping creator revenue share");
      return undefined;
    }

    // 위키 엔트리의 크리에이터 찾기
    const { data: entry, error: entryError } = await supabase
      .from('wiki_entries')
      .select('creator_id')
      .eq('id', wikiEntryId)
      .single();
    
    if (entryError || !entry) {
      console.log("Wiki entry not found or error:", entryError);
      return undefined;
    }

    // 크리에이터의 프로필에서 Tebex Wallet Reference 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tebex_wallet_ref')
      .eq('id', entry.creator_id)
      .single();
    
    if (profileError || !profile || !profile.tebex_wallet_ref) {
      console.log("Creator has no Tebex wallet configured:", profileError);
      return undefined;
    }

    console.log("Found creator wallet ref:", profile.tebex_wallet_ref);
    return profile.tebex_wallet_ref;
  } catch (error) {
    console.error("Error getting creator wallet ref:", error);
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, price, badgeId, quantity, productId, wikiEntryId } = await req.json();
    
    if (!productName || !price) {
      throw new Error("Missing required parameters");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    // Tebex API 인증 정보
    const projectId = "1700450";
    const privateKey = Deno.env.get("TEBEX_PRIVATE_KEY") || "";
    const authString = btoa(`${projectId}:${privateKey}`);

    // 크리에이터 wallet reference 가져오기
    const walletRef = badgeId && wikiEntryId 
      ? await getCreatorWalletRef(badgeId, wikiEntryId, supabaseAdmin)
      : undefined;

    // Step 1: Create basket
    const basketPayload = {
      email: user.email,
      first_name: user.user_metadata?.username || "User",
      last_name: "",
      complete_url: badgeId 
        ? `${req.headers.get("origin")}/purchase?success=true&badge_id=${badgeId}&user_id=${user.id}&quantity=${quantity || 1}&wiki_entry_id=${wikiEntryId || ''}`
        : `${req.headers.get("origin")}/purchase?success=true&product_id=${productId}&user_id=${user.id}`,
      return_url: `${req.headers.get("origin")}/purchase?canceled=true`,
      complete_auto_redirect: true,
      custom: {
        badge_id: badgeId || "",
        user_id: user.id,
        product_id: productId || "",
        quantity: String(quantity || 1),
        wiki_entry_id: wikiEntryId || ""
      }
    };

    console.log("Creating Tebex basket:", JSON.stringify(basketPayload, null, 2));

    const basketResponse = await fetch("https://checkout.tebex.io/api/baskets", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(basketPayload)
    });

    if (!basketResponse.ok) {
      const errorText = await basketResponse.text();
      console.error("Tebex basket creation error:", errorText);
      throw new Error(`Tebex basket creation error: ${basketResponse.status} - ${errorText}`);
    }

    const basket = await basketResponse.json();
    console.log("Tebex basket created:", JSON.stringify(basket, null, 2));

    // Step 2: Add package to basket
    const packagePayload = {
      package: {
        name: productName,
        price: price,
        type: "single"
      },
      qty: quantity || 1,
      type: "single",
      // 위키 엔트리 뱃지 구매 시 크리에이터 수익 분배 (70%)
      revenue_share: walletRef ? [
        {
          wallet_ref: walletRef,
          amount: price * 0.70,
          gateway_fee_percent: 50  // 게이트웨이 수수료 50% 분담
        }
      ] : undefined
    };

    console.log("Adding package to basket:", JSON.stringify(packagePayload, null, 2));

    const packageResponse = await fetch(`https://checkout.tebex.io/api/baskets/${basket.ident}/packages`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(packagePayload)
    });

    if (!packageResponse.ok) {
      const errorText = await packageResponse.text();
      console.error("Tebex package addition error:", errorText);
      throw new Error(`Tebex package addition error: ${packageResponse.status} - ${errorText}`);
    }

    const result = await packageResponse.json();
    console.log("Package added to basket:", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify({ url: result.links.checkout }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
