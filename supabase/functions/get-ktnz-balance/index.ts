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
      return new Response(
        JSON.stringify({ 
          balance: 0,
          balanceWei: "0",
          ethBalance: 0,
          ethBalanceWei: "0",
          usdcBalance: 0,
          usdcBalanceRaw: "0",
          walletAddress: null,
          authenticated: false
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          balance: 0,
          balanceWei: "0",
          ethBalance: 0,
          ethBalanceWei: "0",
          usdcBalance: 0,
          usdcBalanceRaw: "0",
          walletAddress: null,
          authenticated: false
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get user's smart wallet address (QuestN external wallet 제외)
    const { data: walletData, error: walletError } = await supabase
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("network", "base")
      .eq("wallet_type", "smart_wallet")
      .maybeSingle();

    if (walletError || !walletData) {
      console.log("Smart wallet not found for user:", user.id);
      throw new Error("Wallet not found");
    }

    const contractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BASE_RPC_URL");

    if (!contractAddress || !rpcUrl) {
      console.error("Missing configuration");
      throw new Error("Server configuration error");
    }

    console.log("Fetching KTNZ balance for:", walletData.wallet_address);

    try {
      // Create provider
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Create contract interface
      const abi = ["function balanceOf(address account) view returns (uint256)"];
      const contract = new ethers.Contract(contractAddress, abi, provider);

      // Get KTNZ balance
      const ktnzBalance = await contract.balanceOf(walletData.wallet_address);
      const ktnzBalanceFormatted = Number(ethers.formatEther(ktnzBalance));
      
      // Get ETH balance for gas fees
      const ethBalance = await provider.getBalance(walletData.wallet_address);
      const ethBalanceFormatted = Number(ethers.formatEther(ethBalance));

      // USDC 잔액은 DB에서 조회 (온체인이 아님)
      const { data: usdcData } = await serviceSupabase
        .from("usdc_balances")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      
      const usdcBalanceFormatted = usdcData?.balance || 0;

      // Smart Account 배포 여부 확인
      const accountCode = await provider.getCode(walletData.wallet_address);
      const isWalletDeployed = accountCode !== '0x';

      console.log("KTNZ Balance:", ktnzBalanceFormatted);
      console.log("ETH Balance:", ethBalanceFormatted);
      console.log("USDC Balance (DB):", usdcBalanceFormatted);
      console.log("Wallet Deployed:", isWalletDeployed);

      return new Response(
        JSON.stringify({ 
          balance: ktnzBalanceFormatted,
          balanceWei: ktnzBalance.toString(),
          ethBalance: ethBalanceFormatted,
          ethBalanceWei: ethBalance.toString(),
          usdcBalance: usdcBalanceFormatted,
          usdcBalanceRaw: Math.floor(usdcBalanceFormatted * 1e6).toString(),
          walletAddress: walletData.wallet_address,
          authenticated: true,
          isWalletDeployed,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (contractError) {
      console.error("Contract call failed:", contractError);
      
      // Check if contract exists
      const code = await new ethers.JsonRpcProvider(rpcUrl).getCode(contractAddress);
      if (code === "0x") {
        console.error("Contract not deployed at:", contractAddress);
        throw new Error("KTNZ contract not deployed yet. Please deploy the contract first.");
      }
      
      throw contractError;
    }
  } catch (error) {
    console.error("Error getting KTNZ balance:", error);
    
    let errorMessage = "Failed to get KTNZ balance";
    if (error instanceof Error) {
      if (error.message.includes("not deployed")) {
        errorMessage = error.message;
      } else if (error.message.includes("Wallet not found")) {
        errorMessage = "Wallet not found. Please wait for wallet creation.";
      } else if (error.message.includes("Unauthorized")) {
        errorMessage = "Please login to view balance";
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        balance: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error instanceof Error && error.message.includes("not deployed") ? 200 : 500,
      }
    );
  }
});
