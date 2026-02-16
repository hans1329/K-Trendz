import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USDC_DECIMALS = 6;

// FanzTokenUSDC_v4.1 컨트랙트 ABI
const fanzTokenAbi = [
  "function tokens(uint256 tokenId) external view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator)",
  "function calculateBuyCost(uint256 tokenId, uint256 amount) external view returns (uint256 reserve, uint256 artistFund, uint256 platform, uint256 total)"
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId } = await req.json();

    if (!tokenId) {
      throw new Error("tokenId is required");
    }

    console.log("Checking onchain token:", tokenId);

    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    if (!contractAddress) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS environment variable is not set");
    }

    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    if (!rpcUrl) {
      throw new Error("BASE_RPC_URL environment variable is not set");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, fanzTokenAbi, provider);

    // DB token_id를 BigInt로 변환
    const tokenIdUint = BigInt(tokenId);
    console.log("TokenId as BigInt:", tokenIdUint.toString());

    // 온체인 토큰 정보 조회
    const tokenInfo = await contract.tokens(tokenIdUint);
    
    // calculateBuyCost 호출 (v4.1: reserve, artistFund, platform, total)
    const [reserve, artistFund, platform, total] = await contract.calculateBuyCost(tokenIdUint, 1);

    // basePrice는 USDC 6 decimals
    const basePriceUsd = Number(tokenInfo[1]) / (10 ** USDC_DECIMALS);

    // kValue는 컨트랙트에서 1e12 스케일을 사용 (getCurrentPrice에서 /1e12)
    // 따라서 coefficient 값(예: 0.3)을 얻으려면 1e12로 나눔
    const kValueCoefficient = Number(tokenInfo[2]) / 1e12;

    // buyCost는 USDC 6 decimals
    const buyCostUsd = Number(total) / (10 ** USDC_DECIMALS);
    const reserveUsd = Number(reserve) / (10 ** USDC_DECIMALS);
    const artistFundUsd = Number(artistFund) / (10 ** USDC_DECIMALS);
    const platformUsd = Number(platform) / (10 ** USDC_DECIMALS);

    const result = {
      totalSupply: tokenInfo[0].toString(),
      basePrice: basePriceUsd,
      kValue: kValueCoefficient,
      creator: tokenInfo[3],
      basePriceRaw: tokenInfo[1].toString(),
      kValueRaw: tokenInfo[2].toString(),
      buyCostRaw: total.toString(),
      buyCostUsd,
      reserveRaw: reserve.toString(),
      reserveUsd,
      artistFundRaw: artistFund.toString(),
      artistFundUsd,
      platformRaw: platform.toString(),
      platformUsd,
    };

    console.log("Onchain token info:", result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
