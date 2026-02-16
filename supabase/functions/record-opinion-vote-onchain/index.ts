// K-Trendz Support Proposal Opinion Vote 온체인 기록 Edge Function
// - 의견에 대한 찬반 투표를 온체인에 기록
// - KTrendzVoteV3 컨트랙트 활용 (DAU 추적 가능)
// - ERC-4337 UserOperation + Paymaster 가스 스폰서십

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// KTrendzVoteV3 ABI
const VOTE_CONTRACT_ABI = [
  "function vote(address actualVoter, bytes32 artistHash, bytes32 inviteCodeHash, uint256 voteCount) external",
  "function operator() view returns (address)",
];

// SimpleAccount execute ABI
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function owner() view returns (address)",
];

// EntryPoint address (ERC-4337 v0.6)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== record-opinion-vote-onchain start ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const voteContractAddress = Deno.env.get("VOTE_CONTRACT_ADDRESS");
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");

    if (!voteContractAddress) throw new Error("Missing VOTE_CONTRACT_ADDRESS");
    if (!operatorPrivateKey) throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY");
    if (!paymasterUrl) throw new Error("Missing COINBASE_PAYMASTER_URL");

    const { opinionId, userId, voteType, voteWeight } = await req.json();

    // voteWeight는 0일 수 있으므로 undefined/null 체크만 수행
    if (!opinionId || !userId || !voteType || voteWeight === undefined || voteWeight === null) {
      throw new Error("Missing required parameters: opinionId, userId, voteType, voteWeight");
    }

    console.log("Recording opinion vote:", { opinionId, userId, voteType, voteWeight });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 사용자 지갑 주소 조회
    const { data: walletData } = await supabase
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (!walletData?.wallet_address || !ethers.isAddress(walletData.wallet_address)) {
      throw new Error("Could not resolve voter wallet address");
    }

    const voterAddress = walletData.wallet_address;
    console.log("Voter address:", voterAddress);

    // bytes32 해시 생성
    // - artistHash: "OPINION:{opinionId}" 형식으로 의견 식별
    // - inviteCodeHash: voteType (for/against) 기록
    const opinionIdentifier = `OPINION:${opinionId}`;
    const artistHash = ethers.keccak256(ethers.toUtf8Bytes(opinionIdentifier));
    const inviteCodeHash = ethers.keccak256(ethers.toUtf8Bytes(voteType));

    console.log("Opinion identifier:", opinionIdentifier);
    console.log("Artist hash:", artistHash);
    console.log("VoteType hash:", inviteCodeHash);

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    // 컨트랙트 operator 확인
    const voteContractRead = new ethers.Contract(voteContractAddress, VOTE_CONTRACT_ABI, provider);
    const operator = await voteContractRead.operator();
    const backendSmartAccount = ethers.getAddress(operator);

    console.log("Backend Smart Account:", backendSmartAccount);

    // vote() calldata 생성
    const voteInterface = new ethers.Interface(VOTE_CONTRACT_ABI);
    const voteCalldata = voteInterface.encodeFunctionData("vote", [
      voterAddress,
      artistHash,
      inviteCodeHash,
      BigInt(voteWeight),
    ]);

    // Smart Wallet execute() calldata
    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const executeCalldata = accountInterface.encodeFunctionData("execute", [
      voteContractAddress,
      0n,
      voteCalldata,
    ]);

    // Smart Account 배포 여부 확인
    const accountCode = await provider.getCode(backendSmartAccount);
    if (accountCode === "0x") {
      throw new Error("Backend Smart Account is not deployed");
    }

    // 고유 nonce 생성 (replacement underpriced 방지)
    const nonceKey = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`${voterAddress}:${Date.now()}`))) >> 64n;
    
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ]);
    const nonceData = await provider.call({
      to: ENTRY_POINT_ADDRESS,
      data: entryPointInterface.encodeFunctionData("getNonce", [backendSmartAccount, nonceKey]),
    });
    const nonce = BigInt(nonceData);

    console.log("NonceKey:", nonceKey.toString());
    console.log("Nonce:", nonce.toString());

    // Smart Account owner 검증
    const smartAccount = new ethers.Contract(backendSmartAccount, SIMPLE_ACCOUNT_ABI, provider);
    const smartAccountOwner = ethers.getAddress(await smartAccount.owner());
    const signerAddress = ethers.getAddress(ownerWallet.address);

    if (smartAccountOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error("Invalid signer: key does not match Smart Account owner");
    }

    // 동적 가스비 설정 (50% buffer)
    const feeData = await provider.getFeeData();
    const suggestedMaxFeePerGas = (feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.parseUnits("0.05", "gwei")) as bigint;
    const suggestedMaxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.01", "gwei")) as bigint;

    const maxFeePerGas = (suggestedMaxFeePerGas * 15n) / 10n;
    const maxPriorityFeePerGas = (suggestedMaxPriorityFeePerGas * 15n) / 10n;

    console.log("Gas fees:", { maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString() });

    const userOp = {
      sender: backendSmartAccount,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      callGasLimit: "0x30d40", // 200,000
      verificationGasLimit: "0x30d40", // 200,000
      preVerificationGas: "0xc350", // 50,000
      maxFeePerGas: ethers.toQuantity(maxFeePerGas),
      maxPriorityFeePerGas: ethers.toQuantity(maxPriorityFeePerGas),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Paymaster 스폰서십 요청
    console.log("Requesting Paymaster sponsorship...");

    const paymasterRequest = {
      id: 1,
      jsonrpc: "2.0",
      method: "pm_getPaymasterData",
      params: [
        {
          sender: userOp.sender,
          nonce: userOp.nonce,
          initCode: userOp.initCode,
          callData: userOp.callData,
          callGasLimit: userOp.callGasLimit,
          verificationGasLimit: userOp.verificationGasLimit,
          preVerificationGas: userOp.preVerificationGas,
          maxFeePerGas: userOp.maxFeePerGas,
          maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        },
        ENTRY_POINT_ADDRESS,
        "0x2105", // Base Mainnet chain ID
        {},
      ],
    };

    const paymasterResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymasterRequest),
    });

    const paymasterResult = await paymasterResponse.json();
    console.log("Paymaster response:", JSON.stringify(paymasterResult).slice(0, 500));

    if (paymasterResult.error) {
      throw new Error(`Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}`);
    }

    // paymasterAndData 적용
    userOp.paymasterAndData = paymasterResult.result?.paymasterAndData || "0x";

    if (paymasterResult.result?.callGasLimit) userOp.callGasLimit = paymasterResult.result.callGasLimit;
    if (paymasterResult.result?.verificationGasLimit) userOp.verificationGasLimit = paymasterResult.result.verificationGasLimit;
    if (paymasterResult.result?.preVerificationGas) userOp.preVerificationGas = paymasterResult.result.preVerificationGas;

    // UserOperation 해시 계산 및 서명
    const userOpHash = await calculateUserOpHash(userOp, ENTRY_POINT_ADDRESS, 8453n);
    userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

    console.log("UserOp signed, submitting to Bundler...");

    // Bundler에 UserOperation 제출
    const bundlerRequest = {
      id: 2,
      jsonrpc: "2.0",
      method: "eth_sendUserOperation",
      params: [userOp, ENTRY_POINT_ADDRESS],
    };

    const bundlerResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundlerRequest),
    });

    const bundlerResult = await bundlerResponse.json();
    console.log("Bundler response:", JSON.stringify(bundlerResult).slice(0, 500));

    if (bundlerResult.error) {
      throw new Error(`Bundler error: ${bundlerResult.error.message || JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashFromBundler = bundlerResult.result;
    console.log("UserOp hash from bundler:", userOpHashFromBundler);

    // 트랜잭션 receipt 대기 (최대 30초)
    let txHash = "";
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const receiptRequest = {
        id: 3,
        jsonrpc: "2.0",
        method: "eth_getUserOperationReceipt",
        params: [userOpHashFromBundler],
      };

      const receiptResponse = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receiptRequest),
      });

      const receiptResult = await receiptResponse.json();

      if (receiptResult.result?.receipt?.transactionHash) {
        txHash = receiptResult.result.receipt.transactionHash;
        console.log("Transaction confirmed:", txHash);
        break;
      }
    }

    if (!txHash) {
      console.warn("Could not get txHash within timeout, using userOpHash as fallback");
      txHash = userOpHashFromBundler;
    }

    // support_proposal_opinion_votes 테이블에 tx_hash 업데이트
    const { error: updateError } = await supabase
      .from("support_proposal_opinion_votes")
      .update({ tx_hash: txHash })
      .eq("opinion_id", opinionId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update tx_hash:", updateError);
    }

    console.log("=== record-opinion-vote-onchain done ===");

    return new Response(
      JSON.stringify({ success: true, txHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in record-opinion-vote-onchain:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// UserOperation 해시 계산
async function calculateUserOpHash(
  userOp: any,
  entryPoint: string,
  chainId: bigint
): Promise<string> {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "address",
      "uint256",
      "bytes32",
      "bytes32",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
    ],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );

  const userOpHash = ethers.keccak256(packed);

  const finalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, entryPoint, chainId]
    )
  );

  return finalHash;
}
