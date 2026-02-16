import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 백엔드 운영용 Smart Account (ERC-4337) - 카드 결제 후 온체인 구매에 사용
const BACKEND_SMART_ACCOUNT_ADDRESS = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// Base Mainnet USDC
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

const toUsdcMicro = (amountUsd: number): bigint => {
  // 소액 단위라 부동소수점 오차 리스크가 낮지만, 최종 비교용으로만 사용
  return BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
};

const logStep = (step: string, details?: any) => {
  console.log(`[CREATE-FANZTOKEN-CHECKOUT] ${step}`, details || "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Admin client for database queries (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Regular client for auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tokenId, priceUsd, tokenPriceUsd, communityFundAmount, returnPath } = await req.json();
    if (!tokenId || !priceUsd) {
      throw new Error("Missing tokenId or priceUsd");
    }
    logStep("Request data", { tokenId, priceUsd, tokenPriceUsd, communityFundAmount, returnPath });

    // NOTE: Checkout 생성 단계에서는 운영 Smart Account의 USDC 유동성 사전 체크를 하지 않습니다.
    // 결제 완료 후 실제 온체인 처리는 webhook-stripe-fanztoken에서 수행됩니다.


    // Fetch token details to get entry title (using admin client to bypass RLS)
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('fanz_tokens')
      .select('wiki_entry_id, post_id, wiki_entries(title), posts(title)')
      .eq('id', tokenId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("Token not found");
    }

    const entryTitle = tokenData.wiki_entry_id
      ? (tokenData.wiki_entries as any)?.title
      : (tokenData.posts as any)?.title;

    logStep("Entry title retrieved", { entryTitle });

    // Stripe 초기화
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // 기존 고객 확인
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Stripe 최소 금액 제한 ($0.50) 처리
    const minStripeAmount = 0.50;
    const finalPriceUsd = Math.max(priceUsd, minStripeAmount);
    const amountInCents = Math.round(finalPriceUsd * 100);
    logStep("Price calculation", {
      originalPriceUsd: priceUsd,
      finalPriceUsd,
      amountInCents,
      adjustedForMinimum: finalPriceUsd > priceUsd
    });

    // 리다이렉트 URL 설정 (returnPath로 돌아감, 더 이상 session_id 전달 안함)
    const baseUrl = req.headers.get("origin");
    const redirectPath = returnPath || "/my-fanz";
    const successUrl = `${baseUrl}${redirectPath}?payment=success`;
    const cancelUrl = `${baseUrl}${redirectPath}?payment=cancelled`;

    // Checkout 세션 생성
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: `LightStick for ${entryTitle || 'Entry'}`,
              description: "Lightstick Token Purchase",
              images: ["https://auth.k-trendz.com/storage/v1/object/public/brand_assets/logo_7.png"],
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tokenId,
        userId: user.id,
        priceUsd: priceUsd.toString(), // Stripe 수수료 포함 총액
        tokenPriceUsd: (tokenPriceUsd || priceUsd).toString(), // 온체인 토큰 가격
        communityFundAmount: (communityFundAmount || 0).toString(), // 커뮤니티 펀드 적립금
        finalPriceUsd: finalPriceUsd.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
