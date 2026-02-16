// Agent Registration Edge Function
// - 소셜 인증된 에이전트를 verified_agents 테이블에 등록
// - Smart Wallet 주소와 소셜 정보를 연결

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.78.0";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      wallet_address, 
      social_provider, 
      social_id, 
      social_username, 
      social_avatar_url,
      metadata 
    } = await req.json();

    // 필수 필드 검증
    if (!wallet_address || !social_provider || !social_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "wallet_address, social_provider, and social_id are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 지갑 주소 유효성 검증
    if (!ethers.isAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 지원되는 소셜 프로바이더 확인
    const validProviders = ["twitter", "discord", "farcaster", "github"];
    if (!validProviders.includes(social_provider.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid social provider. Supported: ${validProviders.join(", ")}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== agent-register start ===");
    console.log("Wallet:", wallet_address);
    console.log("Provider:", social_provider);
    console.log("Social ID:", social_id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 중복 체크: 같은 소셜 계정으로 이미 등록된 경우
    const { data: existingSocial } = await supabase
      .from("verified_agents")
      .select("id, wallet_address, status")
      .eq("social_provider", social_provider.toLowerCase())
      .eq("social_id", social_id)
      .single();

    if (existingSocial) {
      // 동일 소셜 계정이 다른 지갑으로 등록된 경우
      if (existingSocial.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "This social account is already linked to a different wallet" 
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // 동일 소셜 계정 + 동일 지갑 = 이미 등록됨
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: existingSocial.id,
            status: existingSocial.status,
            message: "Agent already registered"
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 중복 체크: 같은 지갑으로 이미 등록된 경우
    const { data: existingWallet } = await supabase
      .from("verified_agents")
      .select("id, social_provider, status")
      .eq("wallet_address", wallet_address.toLowerCase())
      .single();

    if (existingWallet) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `This wallet is already registered via ${existingWallet.social_provider}` 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 새 에이전트 등록 (status: pending)
    const { data: newAgent, error: insertError } = await supabase
      .from("verified_agents")
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        social_provider: social_provider.toLowerCase(),
        social_id: social_id,
        social_username: social_username || null,
        social_avatar_url: social_avatar_url || null,
        status: "pending",
        paymaster_approved: false,
        daily_limit_usd: 100, // 기본 $100
        daily_tx_limit: 50,   // 기본 50 TX
        metadata: metadata || null
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to register agent: ${insertError.message}`);
    }

    console.log("Agent registered:", newAgent.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: newAgent.id,
          status: newAgent.status,
          wallet_address: newAgent.wallet_address,
          social_provider: newAgent.social_provider,
          social_username: newAgent.social_username,
          message: "Agent registered. Awaiting admin approval."
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Agent register error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
