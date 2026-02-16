// Backend Smart Account 배포 Edge Function
// - SimpleAccountFactory를 통해 Backend Smart Account를 온체인에 배포
// - 이미 배포된 경우 스킵

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SimpleAccountFactory (ERC-4337) - Coinbase 공식
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const BASE_OPERATOR_PRIVATE_KEY = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");

    if (!BASE_OPERATOR_PRIVATE_KEY) {
      throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY");
    }

    console.log("=== deploy-backend-smart-account start ===");

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const operatorWallet = new ethers.Wallet(BASE_OPERATOR_PRIVATE_KEY, provider);

    console.log("Operator EOA address:", operatorWallet.address);

    // SimpleAccountFactory interface
    const factoryInterface = new ethers.Interface([
      "function createAccount(address owner, uint256 salt) returns (address)",
    ]);

    // Smart Account 주소 예측 (salt=0)
    const salt = 0n;
    const predictResult = await provider.call({
      to: SIMPLE_ACCOUNT_FACTORY,
      data: factoryInterface.encodeFunctionData("createAccount", [operatorWallet.address, salt]),
    });
    
    // ethers v6에서는 결과가 address packed 형태로 반환됨
    const decoded = factoryInterface.decodeFunctionResult("createAccount", predictResult) as unknown as [string];
    const predictedAddress = ethers.getAddress(decoded[0]);

    console.log("Predicted Backend Smart Account:", predictedAddress);

    // 이미 배포되었는지 확인
    const code = await provider.getCode(predictedAddress);
    if (code !== "0x") {
      console.log("Backend Smart Account already deployed!");
      return new Response(
        JSON.stringify({
          success: true,
          deployed: true,
          alreadyDeployed: true,
          smartAccountAddress: predictedAddress,
          ownerEOA: operatorWallet.address,
          message: "Smart Account already deployed on-chain",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Smart Account not deployed. Deploying now...");

    // Factory 컨트랙트 인스턴스
    const factory = new ethers.Contract(
      SIMPLE_ACCOUNT_FACTORY,
      ["function createAccount(address owner, uint256 salt) returns (address)"],
      operatorWallet
    );

    // createAccount 트랜잭션 전송
    const tx = await factory.createAccount(operatorWallet.address, salt);
    console.log("Deployment transaction sent:", tx.hash);

    // 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    // 배포 확인
    const codeAfter = await provider.getCode(predictedAddress);
    const isDeployed = codeAfter !== "0x";

    console.log("Deployment verified:", isDeployed);

    return new Response(
      JSON.stringify({
        success: true,
        deployed: isDeployed,
        alreadyDeployed: false,
        smartAccountAddress: predictedAddress,
        ownerEOA: operatorWallet.address,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        message: isDeployed ? "Smart Account deployed successfully" : "Deployment may have failed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deploying Backend Smart Account:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
