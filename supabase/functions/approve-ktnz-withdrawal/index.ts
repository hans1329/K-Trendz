// KTNZ 출금 승인 Edge Function (Backend 대행 방식)
// - 사용자 Smart Wallet이 외부 지갑에게 KTNZ approve
// - Paymaster가 가스비 후원
// - 사용자가 외부 지갑으로 transferFrom 호출하여 출금 완료

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// KTNZ ERC-20 ABI
const KTNZ_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// SimpleAccount execute ABI
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function owner() view returns (address)",
];

// EntryPoint address (ERC-4337 v0.6)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Coinbase Smart Wallet Factory
const COINBASE_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

// AES 복호화 헬퍼 함수
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(encryptionKey), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return decoder.decode(decrypted);
}

// hex 변환 헬퍼
function toRpcHex(value: bigint | number): string {
  const hex = BigInt(value).toString(16);
  return "0x" + (hex === "0" ? "0" : hex);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== approve-ktnz-withdrawal start ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const ktnzContractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");

    if (!ktnzContractAddress) throw new Error("Missing KTREND_CONTRACT_ADDRESS");
    if (!paymasterUrl) throw new Error("Missing COINBASE_PAYMASTER_URL");
    if (!encryptionKey) throw new Error("Missing WALLET_ENCRYPTION_KEY");

    const { externalWalletAddress, amount } = await req.json();

    if (!externalWalletAddress || !ethers.isAddress(externalWalletAddress)) {
      throw new Error("Invalid external wallet address");
    }
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 사용자 인증
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    console.log("User:", user.id);

    // 사용자 지갑 정보 조회
    const { data: walletData } = await supabase
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("network", "base")
      .single();

    if (!walletData?.wallet_address) {
      throw new Error("Wallet not found");
    }

    const userSmartWallet = walletData.wallet_address;
    console.log("User Smart Wallet:", userSmartWallet);

    // 프라이빗 키 조회 및 복호화
    const { data: keyData } = await supabase
      .from("wallet_private_keys")
      .select("encrypted_private_key")
      .eq("user_id", user.id)
      .eq("wallet_address", userSmartWallet)
      .single();

    if (!keyData?.encrypted_private_key) {
      throw new Error("Private key not found");
    }

    let privateKey: string;
    const storedKey = keyData.encrypted_private_key;
    if (/^0x[a-fA-F0-9]{64}$/.test(storedKey)) {
      privateKey = storedKey;
    } else {
      privateKey = await decryptPrivateKey(storedKey, encryptionKey);
    }

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(privateKey, provider);

    console.log("Owner EOA:", ownerWallet.address);

    // KTNZ 잔액 확인
    const ktnzContract = new ethers.Contract(ktnzContractAddress, KTNZ_ABI, provider);
    const balance = await ktnzContract.balanceOf(userSmartWallet);
    const amountWei = ethers.parseEther(amount.toString());

    if (balance < amountWei) {
      throw new Error(`Insufficient KTNZ balance. Have: ${ethers.formatEther(balance)}, Need: ${amount}`);
    }

    console.log("KTNZ Balance:", ethers.formatEther(balance), "Amount to approve:", amount);

    // approve calldata 생성
    const approveCalldata = ktnzContract.interface.encodeFunctionData("approve", [
      externalWalletAddress,
      amountWei,
    ]);

    // Smart Wallet execute calldata
    const simpleAccountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const executeCalldata = simpleAccountInterface.encodeFunctionData("execute", [
      ktnzContractAddress,
      0n,
      approveCalldata,
    ]);

    // Gas 설정
    const feeData = await provider.getFeeData();
    const maxFeePerGasCap = ethers.parseUnits("3", "gwei");
    const maxPriorityFeePerGasCap = ethers.parseUnits("1", "gwei");
    const suggestedMaxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits("0.05", "gwei");
    const suggestedMaxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.01", "gwei");
    
    const maxFeePerGas = suggestedMaxFeePerGas > maxFeePerGasCap ? maxFeePerGasCap : (suggestedMaxFeePerGas * 12n) / 10n;
    const maxPriorityFeePerGas = suggestedMaxPriorityFeePerGas > maxPriorityFeePerGasCap ? maxPriorityFeePerGasCap : (suggestedMaxPriorityFeePerGas * 12n) / 10n;

    // Nonce 조회 (EntryPoint에서)
    const entryPointAbi = ["function getNonce(address sender, uint192 key) view returns (uint256)"];
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, provider);
    const nonce = await entryPoint.getNonce(userSmartWallet, 0);

    console.log("Nonce:", nonce.toString());

    // UserOperation 생성
    const userOp = {
      sender: userSmartWallet,
      nonce: toRpcHex(nonce),
      initCode: "0x",
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      callGasLimit: toRpcHex(200000),
      verificationGasLimit: toRpcHex(150000),
      preVerificationGas: toRpcHex(50000),
      maxFeePerGas: toRpcHex(maxFeePerGas),
      maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Paymaster 데이터 요청
    console.log("Requesting paymaster data...");
    const paymasterResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT_ADDRESS, toRpcHex(8453)],
      }),
    });

    const paymasterResult = await paymasterResponse.json();
    if (paymasterResult.error) {
      console.error("Paymaster error:", paymasterResult.error);
      throw new Error(`Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}`);
    }

    const paymasterData = paymasterResult.result;
    userOp.paymasterAndData = paymasterData.paymasterAndData;
    if (paymasterData.callGasLimit) userOp.callGasLimit = paymasterData.callGasLimit;
    if (paymasterData.verificationGasLimit) userOp.verificationGasLimit = paymasterData.verificationGasLimit;
    if (paymasterData.preVerificationGas) userOp.preVerificationGas = paymasterData.preVerificationGas;

    console.log("Paymaster data received");

    // UserOperation 해시 생성 및 서명
    const packedOp = ethers.AbiCoder.defaultAbiCoder().encode(
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

    const userOpHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [ethers.keccak256(packedOp), ENTRY_POINT_ADDRESS, 8453]
      )
    );

    // ERC-191 서명
    const rawSignature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    
    // Coinbase Smart Wallet용 서명 래핑
    const wrappedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bytes"],
      [0n, rawSignature]
    );
    userOp.signature = wrappedSignature;

    console.log("Signature generated, sending UserOperation...");

    // UserOperation 전송
    const sendResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRY_POINT_ADDRESS],
      }),
    });

    const sendResult = await sendResponse.json();
    if (sendResult.error) {
      console.error("Send UserOp error:", sendResult.error);
      throw new Error(`Failed to send UserOperation: ${sendResult.error.message || JSON.stringify(sendResult.error)}`);
    }

    const userOpHashResult = sendResult.result;
    console.log("UserOperation sent:", userOpHashResult);

    // 트랜잭션 완료 대기 (최대 60초)
    let txHash = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const receiptResponse = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getUserOperationReceipt",
          params: [userOpHashResult],
        }),
      });

      const receiptResult = await receiptResponse.json();
      if (receiptResult.result && receiptResult.result.receipt) {
        txHash = receiptResult.result.receipt.transactionHash;
        console.log("Transaction confirmed:", txHash);
        break;
      }
    }

    if (!txHash) {
      throw new Error("Transaction confirmation timeout");
    }

    // 승인 기록 저장 (optional)
    try {
      await supabase.from("ktnz_withdrawal_approvals").insert({
        user_id: user.id,
        smart_wallet_address: userSmartWallet,
        external_wallet_address: externalWalletAddress,
        amount: amount,
        tx_hash: txHash,
        status: "approved",
      });
    } catch {
      // 테이블이 없어도 무시
      console.log("ktnz_withdrawal_approvals table not found, skipping record");
    }

    console.log("=== approve-ktnz-withdrawal complete ===");

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        approvedAmount: amount,
        smartWallet: userSmartWallet,
        externalWallet: externalWalletAddress,
        message: `Approved ${amount} KTNZ for withdrawal. Use your external wallet to claim.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error in approve-ktnz-withdrawal:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to approve KTNZ withdrawal" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
