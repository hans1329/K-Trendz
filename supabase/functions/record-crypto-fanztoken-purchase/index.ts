import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FanzTokenUSDC V4 컨트랙트 주소 (시크릿 사용)
const FANZTOKEN_CONTRACT = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
if (!FANZTOKEN_CONTRACT) {
  throw new Error("FANZTOKEN_CONTRACT_ADDRESS secret is required");
}
const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const log = (message: string, data?: any) => {
  console.log(`[record-crypto-fanztoken-purchase] ${message}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { tokenId, txHash, walletAddress, amountUsd, communityFundAmount } = await req.json();
    
    log("Recording crypto purchase", { tokenId, txHash, walletAddress, amountUsd });

    if (!tokenId || !txHash || !walletAddress) {
      throw new Error("Missing required fields: tokenId, txHash, walletAddress");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify transaction on-chain
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      throw new Error("Transaction not found on-chain");
    }

    if (receipt.status !== 1) {
      throw new Error("Transaction failed on-chain");
    }

    // Get fanz token details
    const { data: fanzToken, error: tokenError } = await supabaseAdmin
      .from("fanz_tokens")
      .select("*")
      .eq("id", tokenId)
      .single();

    if (tokenError || !fanzToken) {
      throw new Error("Fanz token not found");
    }

    // Update user's balance
    const { data: existingBalance } = await supabaseAdmin
      .from("fanz_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("fanz_token_id", tokenId)
      .single();

    if (existingBalance) {
      await supabaseAdmin
        .from("fanz_balances")
        .update({ 
          balance: existingBalance.balance + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingBalance.id);
    } else {
      await supabaseAdmin
        .from("fanz_balances")
        .insert({
          user_id: user.id,
          fanz_token_id: tokenId,
          balance: 1
        });
    }

    // Update total supply
    await supabaseAdmin
      .from("fanz_tokens")
      .update({ 
        total_supply: fanzToken.total_supply + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", tokenId);

    // Record transaction
    await supabaseAdmin
      .from("fanz_transactions")
      .insert({
        fanz_token_id: tokenId,
        user_id: user.id,
        transaction_type: "buy",
        amount: 1,
        price_per_token: amountUsd,
        total_value: amountUsd,
        payment_value: amountUsd,
        payment_token: "USDC",
        platform_fee: 0, // No platform fee for direct crypto
        creator_fee: 0, // Fees handled on-chain
        tx_hash: txHash
      });

    // Record community fund contribution if applicable
    if (communityFundAmount > 0 && fanzToken.wiki_entry_id) {
      await supabaseAdmin
        .from("entry_fund_transactions")
        .insert({
          wiki_entry_id: fanzToken.wiki_entry_id,
          user_id: user.id,
          amount: communityFundAmount,
          transaction_type: "contribution",
          description: "LightStick purchase (crypto)"
        });

      // Update total fund
      const { data: existingFund } = await supabaseAdmin
        .from("entry_community_funds")
        .select("*")
        .eq("wiki_entry_id", fanzToken.wiki_entry_id)
        .single();

      if (existingFund) {
        await supabaseAdmin
          .from("entry_community_funds")
          .update({ 
            total_fund: existingFund.total_fund + communityFundAmount,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingFund.id);
      } else {
        await supabaseAdmin
          .from("entry_community_funds")
          .insert({
            wiki_entry_id: fanzToken.wiki_entry_id,
            total_fund: communityFundAmount
          });
      }
    }

    // 관리자가 설정한 스타 보너스 지급 (point_rules에서 조회)
    try {
      const { data: bonusRule } = await supabaseAdmin
        .from('point_rules')
        .select('points')
        .eq('action_type', 'fanztoken_purchase_bonus')
        .eq('is_active', true)
        .single();

      const BONUS_STARS = bonusRule?.points || 0;

      if (BONUS_STARS > 0) {
        const { data: currentProfile } = await supabaseAdmin
          .from('profiles')
          .select('available_points, total_points')
          .eq('id', user.id)
          .single();

        if (currentProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ 
              available_points: currentProfile.available_points + BONUS_STARS,
              total_points: currentProfile.total_points + BONUS_STARS
            })
            .eq('id', user.id);

          await supabaseAdmin
            .from('point_transactions')
            .insert({
              user_id: user.id,
              action_type: 'fanztoken_purchase_bonus',
              points: BONUS_STARS,
              reference_id: tokenId
            });

          log("Bonus stars awarded", { userId: user.id, bonus: BONUS_STARS });
        }
      } else {
        log("No bonus stars configured or rule inactive");
      }
    } catch (bonusErr: any) {
      log("WARNING: Failed to award bonus stars", { error: bonusErr.message });
    }

    log("Purchase recorded successfully");

    return new Response(
      JSON.stringify({ success: true, txHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log("Error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
