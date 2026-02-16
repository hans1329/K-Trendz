// Paymaster Sponsor Edge Function
// - verified_agents 테이블에서 에이전트 검증
// - 일일 한도 확인
// - paymasterAndData 서명 반환

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.78.0";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ERC-4337 EntryPoint (v0.6)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const COINBASE_PAYMASTER_URL = Deno.env.get("COINBASE_PAYMASTER_URL");
    const BASE_OPERATOR_PRIVATE_KEY = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");

    if (!COINBASE_PAYMASTER_URL || !BASE_OPERATOR_PRIVATE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const { userOp, agentWallet, estimatedCostUsd } = await req.json();

    if (!userOp || !agentWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "userOp and agentWallet required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== paymaster-sponsor start ===");
    console.log("Agent wallet:", agentWallet);
    console.log("Estimated cost:", estimatedCostUsd, "USD");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. verified_agents 테이블에서 에이전트 확인
    const { data: agent, error: agentError } = await supabase
      .from("verified_agents")
      .select("*")
      .eq("wallet_address", agentWallet.toLowerCase())
      .eq("status", "verified")
      .eq("paymaster_approved", true)
      .single();

    if (agentError || !agent) {
      console.log("Agent not verified:", agentError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Agent not verified or not approved for paymaster" 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Agent verified:", agent.social_username);

    // 2. 일일 한도 확인
    const costToCheck = estimatedCostUsd || 1; // 기본 1 USD
    const { data: limitCheck, error: limitError } = await supabase.rpc(
      "check_agent_daily_limit",
      {
        _agent_id: agent.id,
        _amount_usd: costToCheck
      }
    );

    if (limitError) {
      console.error("Limit check error:", limitError);
      throw new Error(`Limit check failed: ${limitError.message}`);
    }

    if (!limitCheck) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Daily limit exceeded. Limit: $${agent.daily_limit_usd}` 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Daily limit check passed");

    // 3. Coinbase Paymaster에서 paymasterAndData 획득
    const paymasterPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "pm_getPaymasterData",
      params: [
        userOp,
        ENTRY_POINT_ADDRESS,
        "0x2105" // Base Mainnet chain ID (8453 in hex)
      ]
    };

    console.log("Requesting paymaster data...");
    const paymasterResponse = await fetch(COINBASE_PAYMASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymasterPayload)
    });

    const paymasterResult = await paymasterResponse.json();

    if (paymasterResult.error) {
      console.error("Paymaster error:", paymasterResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Paymaster error: ${paymasterResult.error.message}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Paymaster data received");

    // 4. 트랜잭션 사전 기록 (pending)
    const { data: txRecord, error: txError } = await supabase
      .from("agent_transactions")
      .insert({
        agent_id: agent.id,
        tx_type: "sponsored",
        tx_hash: userOp.sender + "-" + Date.now(), // 임시 식별자
        price_usdc: costToCheck,
        total_usdc: costToCheck,
        status: "pending"
      })
      .select()
      .single();

    if (txError) {
      console.warn("Failed to record transaction:", txError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          paymasterAndData: paymasterResult.result?.paymasterAndData,
          paymasterData: paymasterResult.result,
          agentId: agent.id,
          transactionId: txRecord?.id,
          remainingDailyLimit: agent.daily_limit_usd - costToCheck
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Paymaster sponsor error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
