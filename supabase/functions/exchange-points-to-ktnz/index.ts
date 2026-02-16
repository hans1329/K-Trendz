import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { pointsToExchange } = await req.json();
    
    if (!pointsToExchange || pointsToExchange <= 0) {
      throw new Error("Invalid points amount");
    }

    // Get user's profile to check available points
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("available_points")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (profile.available_points < pointsToExchange) {
      throw new Error("Insufficient points");
    }

    // Get user's wallet
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("network", "base")
      .single();

    if (walletError || !walletData) {
      throw new Error("Wallet not found");
    }

    // Get minter private key from Supabase Secret (already encrypted and secure)
    const minterPrivateKey = Deno.env.get("MINTER_PRIVATE_KEY");
    if (!minterPrivateKey) {
      throw new Error("MINTER_PRIVATE_KEY not configured in Supabase secrets");
    }

    const contractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    const pointsToTokenRate = Deno.env.get("POINTS_TO_TOKEN_RATE") || "1000"; // Default: 1000 points = 1 KTNZ

    if (!contractAddress || !rpcUrl) {
      throw new Error("Contract configuration missing");
    }

    // Calculate token amount
    const tokenAmount = pointsToExchange / parseInt(pointsToTokenRate);
    const tokenAmountWei = ethers.parseEther(tokenAmount.toString());

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minterWallet = new ethers.Wallet(minterPrivateKey, provider);

    // Contract ABI
    const abi = [
      "function mint(address to, uint256 amount) returns (bool)",
      "function hasRole(bytes32 role, address account) view returns (bool)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, minterWallet);

    // Verify minter has MINTER_ROLE
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const hasMinterRole = await contract.hasRole(MINTER_ROLE, minterWallet.address);
    
    if (!hasMinterRole) {
      throw new Error("Minter wallet does not have MINTER_ROLE");
    }

    // Mint tokens to user's wallet
    console.log(`Minting ${tokenAmount} KTNZ to ${walletData.wallet_address}`);
    const tx = await contract.mint(walletData.wallet_address, tokenAmountWei);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    // Deduct points from user
    const { error: deductError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        available_points: profile.available_points - pointsToExchange 
      })
      .eq("id", user.id);

    if (deductError) {
      console.error("Failed to deduct points:", deductError);
      // Transaction succeeded but points deduction failed - log for manual review
      throw new Error("Token minted but failed to deduct points - contact support");
    }

    // Record transaction (tx hash logged above)
    console.log(`Recording exchange transaction (tx hash: ${receipt.hash})`);
    await supabaseAdmin.from("point_transactions").insert({
      user_id: user.id,
      action_type: "exchange_to_ktnz",
      points: -pointsToExchange,
      reference_id: null // Tx hash는 로그에 기록됨
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionHash: receipt.hash,
        tokenAmount,
        pointsExchanged: pointsToExchange,
        message: `Successfully exchanged ${pointsToExchange} points for ${tokenAmount} KTNZ`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Exchange error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to exchange points"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
