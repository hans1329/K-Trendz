import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FanzTokenUSDC V4 계약 ABI
const FANZTOKEN_ABI = [
  // V4: returns (reserveCost, artistFundFee, platformFee, totalCost)
  "function calculateBuyCost(uint256 tokenId, uint256 amount) view returns (uint256 reserveCost, uint256 artistFundFee, uint256 platformFee, uint256 totalCost)",
  // V4: returns (grossRefund, platformFee, netRefund)
  "function calculateSellRefund(uint256 tokenId, uint256 amount) view returns (uint256 grossRefund, uint256 platformFee, uint256 netRefund)",
  // V4 tokens struct includes 'exists' bool
  "function tokens(uint256 tokenId) view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator, bool exists)",
];

// FanzTokenUSDC V4 계약 주소 (시크릿에서 가져오거나 하드코딩)
const FANZTOKEN_CONTRACT_ADDRESS = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
if (!FANZTOKEN_CONTRACT_ADDRESS) {
  throw new Error("FANZTOKEN_CONTRACT_ADDRESS secret is required");
}

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // tokenId를 string으로 받아서 BigInt overflow 방지
    const tokenIdStr = String(body.tokenId);
    const amount = body.amount || 1;
    // V4 컨트랙트 사용
    const contractAddress = FANZTOKEN_CONTRACT_ADDRESS;

    if (!tokenIdStr || tokenIdStr === 'undefined' || tokenIdStr === 'null') {
      return new Response(
        JSON.stringify({ error: 'tokenId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Alchemy RPC URL 구성
    const alchemyApiKey = Deno.env.get('ALCHEMY_API_KEY');
    if (!alchemyApiKey) {
      console.error('ALCHEMY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'RPC not configured', fallback: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    console.log(`Fetching price for tokenId: ${tokenIdStr}, amount: ${amount}, contract: ${contractAddress}`);

    // Provider 생성
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 8453,
      name: 'base'
    });

    // 계약 인스턴스 생성 (전달받은 contract address 사용)
    const contract = new ethers.Contract(
      contractAddress,
      FANZTOKEN_ABI,
      provider
    );

    // 병렬로 데이터 조회 - V3 ABI 사용
    const [buyCostResult, tokenInfo] = await Promise.all([
      contract.calculateBuyCost(tokenIdStr, amount).catch((e: Error) => {
        console.error('calculateBuyCost error:', e.message);
        return null;
      }),
      contract.tokens(tokenIdStr).catch((e: Error) => {
        console.error('tokens() error:', e.message);
        return null;
      }),
    ]);

    // V4: calculateBuyCost returns (reserveCost, artistFundFee, platformFee, totalCost)
    const reserveCost = buyCostResult ? buyCostResult[0] : 0n;
    const artistFundFee = buyCostResult ? buyCostResult[1] : 0n;
    const platformFee = buyCostResult ? buyCostResult[2] : 0n;
    const totalCost = buyCostResult ? buyCostResult[3] : 0n;
    
    // V4 tokens() returns (totalSupply, basePrice, kValue, creator, exists)
    const totalSupply = tokenInfo ? tokenInfo[0] : 0n;
    const basePrice = tokenInfo ? tokenInfo[1] : 0n;
    const kValue = tokenInfo ? tokenInfo[2] : 0n;
    const creator = tokenInfo ? tokenInfo[3] : null;
    const tokenExists = tokenInfo ? tokenInfo[4] : false;

    console.log(`On-chain data - totalCost: ${totalCost}, reserveCost: ${reserveCost}, artistFundFee: ${artistFundFee}, platformFee: ${platformFee}`);
    console.log(`Token info - totalSupply: ${totalSupply}, basePrice: ${basePrice}, kValue: ${kValue}, creator: ${creator}, exists: ${tokenExists}`);

    // USDC는 6 decimals
    const USDC_DECIMALS = 6;
    const totalCostFormatted = Number(totalCost) / Math.pow(10, USDC_DECIMALS);
    const reserveCostFormatted = Number(reserveCost) / Math.pow(10, USDC_DECIMALS);
    const artistFundFeeFormatted = Number(artistFundFee) / Math.pow(10, USDC_DECIMALS);
    const platformFeeFormatted = Number(platformFee) / Math.pow(10, USDC_DECIMALS);
    const totalSupplyNumber = Number(totalSupply);
    const basePriceFormatted = Number(basePrice) / Math.pow(10, USDC_DECIMALS);

    // kValueRaw: 온체인에 저장된 kValue (USDC 6 decimals 계수값)
    // 예) 200000 → 0.2
    const kValueRaw = kValue;
    const kValueFormatted = Number(kValueRaw);

    // 토큰이 등록되어 있는지 확인 (V4: exists boolean 사용)
    const isTokenRegistered = tokenExists === true ||
      (typeof creator === 'string' && creator !== '0x0000000000000000000000000000000000000000');

    // V4 calculateSellRefund returns (grossRefund, platformFee, netRefund)
    let sellGrossRefund = 0;
    let sellPlatformFee = 0;
    let sellNetRefund = 0;
    if (totalSupplyNumber > 0) {
      try {
        const sellResult = await contract.calculateSellRefund(tokenIdStr, amount);
        sellGrossRefund = Number(sellResult[0]) / Math.pow(10, USDC_DECIMALS);
        sellPlatformFee = Number(sellResult[1]) / Math.pow(10, USDC_DECIMALS);
        sellNetRefund = Number(sellResult[2]) / Math.pow(10, USDC_DECIMALS);
      } catch (e) {
        console.error('calculateSellRefund error:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tokenId: tokenIdStr,
          amount: Number(amount),
          // V4 분리된 가격 정보
          buyCostUsd: totalCostFormatted,  // 총 구매 비용 (Reserve + Artist Fund + Platform)
          reserveCostUsd: reserveCostFormatted,  // Reserve (70%)
          artistFundFeeUsd: artistFundFeeFormatted,  // Artist Fund (20%)
          platformFeeUsd: platformFeeFormatted,  // Platform (10%)
          // 판매 정보
          sellGrossRefund,  // 판매시 총 환불액
          sellPlatformFee,  // 판매시 플랫폼 수수료 (4%)
          sellNetRefund,    // 판매시 순 환불액 (96%)
          // 토큰 정보
          totalSupply: totalSupplyNumber,
          basePrice: basePriceFormatted,
          kValue: kValueFormatted,
          isOnchainData: totalCostFormatted > 0,
          isTokenRegistered,
          // 호환성을 위한 레거시 필드
          buyCost: totalCostFormatted,
          sellReturn: sellNetRefund,
          sellFee: sellPlatformFee,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch price';
    console.error('Error in get-fanztoken-price:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
