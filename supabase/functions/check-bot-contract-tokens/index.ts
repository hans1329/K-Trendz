// deno.land 대신 Deno.serve 사용
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FanzTokenBotV3 컨트랙트 주소
const BOT_CONTRACT_ADDRESS = "0xBBf57b07847E355667D4f8583016dD395c5cB1D1";

// FanzTokenBotV3 ABI (info 함수 — V2와 동일)
const botContractAbi = [
  "function info(uint256 id) external view returns (uint256 supply, uint256 base, uint256 k, address creator, bool exists)"
];

// 등록해야 할 7개 토큰
const TOKENS = [
  { name: "K-Trendz Supporters", tokenId: "12666454296509763493" },
  { name: "RIIZE", tokenId: "7963681970480434413" },
  { name: "Ive", tokenId: "4607865675402095874" },
  { name: "Cortis", tokenId: "13766662462343366758" },
  { name: "BTS", tokenId: "9138265216282739420" },
  { name: "All Day Project", tokenId: "18115915419890895215" },
  { name: "SEVENTEEN", tokenId: "14345496278571827420" },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    if (!rpcUrl) {
      throw new Error("BASE_RPC_URL environment variable is not set");
    }

    console.log("Checking Bot Contract:", BOT_CONTRACT_ADDRESS);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(BOT_CONTRACT_ADDRESS, botContractAbi, provider);

    const results = [];

    for (const token of TOKENS) {
      try {
        const tokenIdBigInt = BigInt(token.tokenId);
        const info = await contract.info(tokenIdBigInt);
        
        results.push({
          name: token.name,
          tokenId: token.tokenId,
          exists: info[4], // exists
          totalSupply: info[0].toString(),
          basePrice: Number(info[1]) / 1e6, // USDC 6 decimals
          kValue: info[2].toString(),
          creator: info[3],
        });
      } catch (err: unknown) {
        results.push({
          name: token.name,
          tokenId: token.tokenId,
          exists: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const registeredCount = results.filter(r => r.exists).length;
    
    console.log(`Registered: ${registeredCount}/${TOKENS.length}`);
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        contractAddress: BOT_CONTRACT_ADDRESS,
        totalTokens: TOKENS.length,
        registeredCount,
        tokens: results,
      }),
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
