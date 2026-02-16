// 의견 제안(Opinion Submission) 온체인 기록 Edge Function
// - 의견 제안을 온체인에 기록
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
    console.log("=== record-opinion-onchain start ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const voteContractAddress = Deno.env.get("VOTE_CONTRACT_ADDRESS");
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");

    if (!voteContractAddress) throw new Error("Missing VOTE_CONTRACT_ADDRESS");
    if (!operatorPrivateKey) throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY");
    if (!paymasterUrl) throw new Error("Missing COINBASE_PAYMASTER_URL");

    const { opinionId, userId, proposalId, opinion } = await req.json();

    if (!opinionId || !userId) {
      throw new Error("Missing required parameters: opinionId, userId");
    }

    console.log("Recording opinion submission:", { opinionId, userId });

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
    // - artistHash: "OPINION_SUBMIT:{opinionId}" 형식으로 의견 제안 식별
    // - inviteCodeHash: "submit" 태그
    const opinionIdentifier = `OPINION_SUBMIT:${opinionId}`;
    const artistHash = ethers.keccak256(ethers.toUtf8Bytes(opinionIdentifier));
    const inviteCodeHash = ethers.keccak256(ethers.toUtf8Bytes("submit"));

    console.log("Opinion identifier:", opinionIdentifier);
    console.log("Artist hash:", artistHash);
    console.log("InviteCode hash:", inviteCodeHash);

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    // 컨트랙트 operator 확인
    const voteContractRead = new ethers.Contract(voteContractAddress, VOTE_CONTRACT_ABI, provider);
    const operator = await voteContractRead.operator();
    const backendSmartAccount = ethers.getAddress(operator);

    console.log("Backend Smart Account:", backendSmartAccount);

    // vote() calldata 생성 - voteCount = 1 for opinion submission
    const voteInterface = new ethers.Interface(VOTE_CONTRACT_ABI);
    const voteCalldata = voteInterface.encodeFunctionData("vote", [
      voterAddress,
      artistHash,
      inviteCodeHash,
      1n,
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

    // 고유 nonce key 생성 (replacement underpriced 방지)
    // NOTE: EntryPoint.getNonce(sender, key)는 key에 대한 nonce 스트림을 분리해준다.
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
      // EntryPoint.getNonce는 이미 key를 포함한 nonce(uint256)를 반환한다.
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      callGasLimit: "0x30000",
      verificationGasLimit: "0x20000",
      preVerificationGas: "0x10000",
      maxFeePerGas: "0x" + maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    console.log("UserOp before paymaster:", JSON.stringify(userOp, null, 2));

    // Paymaster 스폰서십 요청
    // NOTE: pm_sponsorUserOperation은 UserOp.signature 길이를 검증하며, 여기서는 아직 서명 전이므로
    //       pm_getPaymasterData를 사용해 paymasterAndData를 먼저 받은 뒤 서명한다. (성공 패턴)
    const paymasterRequestBody = {
      jsonrpc: "2.0",
      id: Date.now(),
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
        "0x2105", // Base Mainnet chainId (8453)
        {},
      ],
    };

    console.log("Requesting paymaster sponsorship...");
    const paymasterResp = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymasterRequestBody),
    });
    const paymasterJson = await paymasterResp.json();
    console.log("Paymaster response:", JSON.stringify(paymasterJson, null, 2));

    if (paymasterJson.error) {
      throw new Error(`Paymaster error: ${JSON.stringify(paymasterJson.error)}`);
    }
    if (!paymasterJson.result?.paymasterAndData) {
      throw new Error("Paymaster did not return paymasterAndData");
    }

    // Paymaster 결과 적용
    userOp.paymasterAndData = paymasterJson.result.paymasterAndData;
    if (paymasterJson.result.callGasLimit) userOp.callGasLimit = paymasterJson.result.callGasLimit;
    if (paymasterJson.result.verificationGasLimit) userOp.verificationGasLimit = paymasterJson.result.verificationGasLimit;
    if (paymasterJson.result.preVerificationGas) userOp.preVerificationGas = paymasterJson.result.preVerificationGas;

    console.log("Paymaster sponsorship obtained");

    // UserOp 해시 계산
    const userOpHash = await calculateUserOpHash(userOp, ENTRY_POINT_ADDRESS, 8453n);
    console.log("UserOp hash:", userOpHash);

    // 서명
    const signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    console.log("UserOp signed, sending to bundler...");

    // Bundler로 전송
    const bundlerRequestBody = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_sendUserOperation",
      params: [userOp, ENTRY_POINT_ADDRESS],
    };

    const bundlerResp = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundlerRequestBody),
    });
    const bundlerJson = await bundlerResp.json();
    console.log("Bundler response:", JSON.stringify(bundlerJson, null, 2));

    if (bundlerJson.error) {
      throw new Error(`Bundler error: ${JSON.stringify(bundlerJson.error)}`);
    }

    const userOpHashResult = bundlerJson.result;
    console.log("UserOp submitted:", userOpHashResult);

    // 트랜잭션 확인 대기
    let txHash: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const receiptResp = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_getUserOperationReceipt",
          params: [userOpHashResult],
        }),
      });
      const receiptJson = await receiptResp.json();

      if (receiptJson.result?.receipt?.transactionHash) {
        txHash = receiptJson.result.receipt.transactionHash;
        console.log("Transaction confirmed:", txHash);
        break;
      }
    }

    if (!txHash) {
      console.warn("Transaction not confirmed in time, using UserOp hash as fallback");
      txHash = userOpHashResult;
    }

    // DB에 tx_hash 업데이트
    const { error: updateError } = await supabase
      .from("support_proposal_opinions")
      .update({ tx_hash: txHash })
      .eq("id", opinionId);

    if (updateError) {
      console.error("Failed to update tx_hash in DB:", updateError);
    } else {
      console.log("tx_hash updated in DB");
    }

    return new Response(
      JSON.stringify({ success: true, txHash, userOpHash: userOpHashResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in record-opinion-onchain:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// UserOp 해시 계산 (ERC-4337 표준)
async function calculateUserOpHash(
  userOp: Record<string, string>,
  entryPoint: string,
  chainId: bigint
): Promise<string> {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const packed = abiCoder.encode(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
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

  const innerHash = ethers.keccak256(packed);

  return ethers.keccak256(
    abiCoder.encode(["bytes32", "address", "uint256"], [innerHash, entryPoint, chainId])
  );
}
