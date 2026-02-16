import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base Mainnet
const BASE_MAINNET_RPC = Deno.env.get("BASE_RPC_URL");

// Backend Operator - SimpleAccount
const BACKEND_OPERATOR_ADDRESS = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// Paymaster/Bundler (시크릿으로 주입)
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

// FanzToken V4 ABI (transferFor)
const FANZTOKEN_V4_ABI = [
  "function transferFor(uint256 tokenId, address from, address to, uint256 amount) external",
  "function balanceOf(address account, uint256 tokenId) external view returns (uint256)",
  "function isOperator(address account) external view returns (bool)",
];

// SimpleAccount ABI
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function getNonce() external view returns (uint256)",
];

interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

function toRpcHex(value: bigint | number): string {
  const hex = BigInt(value).toString(16);
  return `0x${hex}`;
}

function getUserOpHash(userOp: UserOperation, entryPoint: string, chainId: bigint): string {
  const packedUserOp = ethers.AbiCoder.defaultAbiCoder().encode(
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
  const userOpHash = ethers.keccak256(packedUserOp);
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );
  return ethers.keccak256(encoded);
}

function normalizeAddress(input: string, label: string): string {
  try {
    // ethers v6는 mixed-case가 들어오면 checksum 검증을 강제하므로, lower로 정규화 후 checksummed로 변환합니다.
    return ethers.getAddress(input.trim().toLowerCase());
  } catch {
    throw new Error(`Invalid address for ${label}: ${input}`);
  }
}

function logStep(step: string, data?: unknown) {
  console.log(`[ADMIN-TRANSFER] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Admin 권한 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Admin 체크
    const { data: adminCheck } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminCheck) {
      throw new Error("Admin access required");
    }

    const { fromAddress, toAddress, tokenId, amount } = await req.json();

    if (!fromAddress || !toAddress || !tokenId || !amount) {
      throw new Error("Missing required parameters: fromAddress, toAddress, tokenId, amount");
    }

    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
    if (!paymasterUrl) {
      throw new Error("COINBASE_PAYMASTER_URL not configured");
    }

    const fanzTokenAddressRaw = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    if (!fanzTokenAddressRaw) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS not configured");
    }

    const fanzTokenAddress = normalizeAddress(fanzTokenAddressRaw, "FANZTOKEN_CONTRACT_ADDRESS");
    const fromAddr = normalizeAddress(String(fromAddress), "fromAddress");
    const toAddr = normalizeAddress(String(toAddress), "toAddress");
    const backendOperatorAddr = normalizeAddress(BACKEND_OPERATOR_ADDRESS, "BACKEND_OPERATOR_ADDRESS");
    const amountBigInt = BigInt(amount);

    logStep("Admin transfer request", {
      fromAddress: fromAddr,
      toAddress: toAddr,
      tokenId,
      amount: amountBigInt.toString(),
      adminId: user.id,
    });

    // Provider 설정
    if (!BASE_MAINNET_RPC) {
      throw new Error("BASE_RPC_URL not configured");
    }
    const provider = new ethers.JsonRpcProvider(BASE_MAINNET_RPC);
    const chainId = 8453n;

    // Backend Operator 키 로드
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    if (!operatorPrivateKey) {
      throw new Error("BASE_OPERATOR_PRIVATE_KEY not configured");
    }

    let normalizedKey = operatorPrivateKey.trim();
    if (!normalizedKey.startsWith("0x")) {
      normalizedKey = `0x${normalizedKey}`;
    }
    const operatorEoa = new ethers.Wallet(normalizedKey, provider);
    logStep("Operator EOA loaded", { address: operatorEoa.address });

    // 컨트랙트 인스턴스
    const fanzTokenContract = new ethers.Contract(fanzTokenAddress, FANZTOKEN_V4_ABI, provider);

    // 1. Operator 권한 확인
    const isOperator = await fanzTokenContract.isOperator(backendOperatorAddr);
    logStep("Operator status", { isOperator });
    if (!isOperator) {
      throw new Error("Backend account is not an operator on V4 contract");
    }

    // 2. 잔액 확인
    const balance = await fanzTokenContract.balanceOf(fromAddr, tokenId);
    logStep("Source balance", { balance: balance.toString() });
    if (balance < amountBigInt) {
      throw new Error(`Insufficient balance: has ${balance.toString()}, need ${amountBigInt.toString()}`);
    }

    // 3. transferFor calldata 생성
    const transferForData = fanzTokenContract.interface.encodeFunctionData("transferFor", [
      tokenId,
      fromAddr,
      toAddr,
      amountBigInt,
    ]);
    logStep("TransferFor calldata prepared");

    // 4. SimpleAccount execute calldata
    const simpleAccountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const executeCallData = simpleAccountInterface.encodeFunctionData("execute", [
      fanzTokenAddress,
      0n,
      transferForData,
    ]);

    // 5. Nonce 조회
    const simpleAccountContract = new ethers.Contract(backendOperatorAddr, SIMPLE_ACCOUNT_ABI, provider);
    const nonce = await simpleAccountContract.getNonce();
    logStep("Nonce", { nonce: nonce.toString() });

    // 6. Gas 정보
    const feeData = await provider.getFeeData();
    const baseFee = feeData.gasPrice ?? 1000000n;
    const maxPriorityFeePerGas = 1500000n;
    const maxFeePerGas = (baseFee * 12n) / 10n + maxPriorityFeePerGas;

    // 7. UserOperation 구성
    const userOp: UserOperation = {
      sender: backendOperatorAddr,
      nonce: toRpcHex(nonce),
      initCode: "0x",
      callData: executeCallData + BUILDER_CODE_SUFFIX,
      callGasLimit: toRpcHex(500000),
      verificationGasLimit: toRpcHex(200000),
      preVerificationGas: toRpcHex(100000),
      maxFeePerGas: toRpcHex(maxFeePerGas),
      maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // 8. Paymaster 데이터 요청
    const paymasterResp = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT, toRpcHex(chainId)],
      }),
    });

    const paymasterResult = await paymasterResp.json();
    logStep("Paymaster response", paymasterResult);

    if (paymasterResult.error) {
      throw new Error(`Paymaster error: ${JSON.stringify(paymasterResult.error)}`);
    }

    userOp.paymasterAndData = paymasterResult.result.paymasterAndData;

    // gas limits 업데이트
    if (paymasterResult.result.callGasLimit) {
      userOp.callGasLimit = paymasterResult.result.callGasLimit;
    }
    if (paymasterResult.result.verificationGasLimit) {
      userOp.verificationGasLimit = paymasterResult.result.verificationGasLimit;
    }
    if (paymasterResult.result.preVerificationGas) {
      userOp.preVerificationGas = paymasterResult.result.preVerificationGas;
    }

    // 9. UserOp 서명
    const userOpHash = getUserOpHash(userOp, ENTRY_POINT, chainId);
    const signature = await operatorEoa.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;
    logStep("UserOp signed");

    // 10. Bundler로 전송
    const bundlerResp = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRY_POINT],
      }),
    });

    const bundlerResult = await bundlerResp.json();
    logStep("Bundler response", bundlerResult);

    if (bundlerResult.error) {
      throw new Error(`Bundler error: ${JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashReturned = bundlerResult.result;

    // 11. Receipt 대기 (최대 60초)
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const receiptResp = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getUserOperationReceipt",
          params: [userOpHashReturned],
        }),
      });

      const receiptResult = await receiptResp.json();
      if (receiptResult.result) {
        receipt = receiptResult.result;
        break;
      }
    }

    if (!receipt) {
      throw new Error("Transaction receipt not found within timeout");
    }

    const txHash = (receipt.receipt?.transactionHash as string | undefined) ?? null;
    const userOpSucceeded = receipt.success === true || receipt.success === "0x1" || receipt.success === 1;

    logStep("Transaction completed", {
      txHash,
      success: receipt.success,
    });

    // 12. 새 잔액 확인 (성공/실패 모두 확인해서 응답에 포함)
    const newFromBalance = await fanzTokenContract.balanceOf(fromAddr, tokenId);
    const newToBalance = await fanzTokenContract.balanceOf(toAddr, tokenId);

    if (!userOpSucceeded) {
      // UserOperation이 실패했는데도 EntryPoint 트랜잭션 자체는 성공(=status 1)로 보일 수 있어 UI에서 반드시 구분해야 합니다.
      return new Response(
        JSON.stringify({
          success: false,
          txHash,
          fromBalance: newFromBalance.toString(),
          toBalance: newToBalance.toString(),
          error: "UserOperation failed (receipt.success=false)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        fromBalance: newFromBalance.toString(),
        toBalance: newToBalance.toString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: errorMessage });
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

