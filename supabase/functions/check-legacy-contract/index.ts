import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 기존 ETH 기반 컨트랙트 주소
const LEGACY_CONTRACT_ADDRESS = "0x8B6d809574ac4634AA9fceAcA4DC6C22a622346E";

// Alchemy RPC 우선 사용
const getBaseRpcUrl = () => {
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  if (alchemyKey) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  return Deno.env.get('BASE_RPC_URL') || "https://mainnet.base.org";
};
const BASE_RPC_URL = getBaseRpcUrl();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking legacy ETH contract balance...");

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // 컨트랙트 ETH 잔액 조회
    const balanceWei = await provider.getBalance(LEGACY_CONTRACT_ADDRESS);
    const balanceEth = ethers.formatEther(balanceWei);
    
    console.log("Legacy contract balance:", balanceEth, "ETH");

    // ETH/USD 가격 조회
    let balanceUsd = 0;
    try {
      const priceResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 0;
      balanceUsd = parseFloat(balanceEth) * ethPrice;
      console.log("ETH price:", ethPrice, "USD, Balance in USD:", balanceUsd);
    } catch (priceError) {
      console.error("Error fetching ETH price:", priceError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contractAddress: LEGACY_CONTRACT_ADDRESS,
        balanceWei: balanceWei.toString(),
        balanceEth: balanceEth,
        balanceUsd: balanceUsd.toFixed(2),
        canWithdraw: false,
        withdrawMessage: "기존 컨트랙트에 출금 함수가 없어 ETH 출금이 불가능합니다."
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error checking legacy contract:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
