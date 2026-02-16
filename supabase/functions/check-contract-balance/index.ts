import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// USDC 컨트랙트 ABI (balanceOf만 필요)
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

// Base Mainnet USDC 주소
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Base Mainnet chainId
const BASE_CHAIN_ID = 8453n;

const uniqueNonEmpty = (values: Array<string | undefined | null>) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

const fetchUsdcBalance = async (rpcUrl: string, contractAddress: string) => {
  // NOTE: 일부 RPC(또는 잘못된 체인 RPC)가 Base가 아니면 USDC 주소에 코드가 없어
  // eth_call이 빈 데이터를 반환하면서 ethers가 "missing revert data"로 에러를 낸다.
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const network = await provider.getNetwork();
  if (network.chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `RPC is not Base mainnet (expected ${BASE_CHAIN_ID.toString()}, got ${network.chainId.toString()}).`,
    );
  }

  const code = await provider.getCode(USDC_ADDRESS);
  if (!code || code === "0x") {
    throw new Error(
      "USDC contract not found on this RPC (no contract code). Ensure the RPC points to Base mainnet.",
    );
  }

  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const balance = await usdcContract.balanceOf(contractAddress);

  return {
    balance,
    chainId: network.chainId.toString(),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawContractAddress = Deno.env.get("CHALLENGE_CONTRACT_ADDRESS");
    if (!rawContractAddress) {
      throw new Error("CHALLENGE_CONTRACT_ADDRESS not configured");
    }

    // 주소 형식/체크섬 정규화 (잘못된 형식이면 여기서 즉시 에러)
    const contractAddress = ethers.getAddress(rawContractAddress);

    // 우선순위: Alchemy(있다면) → BASE_RPC_URL(있다면) → Base public RPC(항상)
    // env가 잘못된 체인(예: Ethereum mainnet)으로 세팅되어도 public RPC로 자동 폴백되게 한다.
    const rpcCandidates = uniqueNonEmpty([
      Deno.env.get("ALCHEMY_BASE_RPC_URL"),
      Deno.env.get("BASE_RPC_URL"),
      "https://mainnet.base.org",
    ]);

    let lastError: unknown = null;

    for (const rpcUrl of rpcCandidates) {
      try {
        const { balance, chainId } = await fetchUsdcBalance(rpcUrl, contractAddress);
        const balanceFormatted = ethers.formatUnits(balance, 6);

        console.log("Contract USDC balance:", balanceFormatted, "rpc:", rpcUrl, "chainId:", chainId);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              contractAddress,
              usdcBalance: balanceFormatted,
              usdcBalanceRaw: balance.toString(),
              rpcUsed: rpcUrl,
              chainId,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("RPC attempt failed:", rpcUrl, msg);
        // 다음 RPC로 폴백
      }
    }

    const finalMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`All RPC endpoints failed. Last error: ${finalMessage}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error checking contract balance:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
