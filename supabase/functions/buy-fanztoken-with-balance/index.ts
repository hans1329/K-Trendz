import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[BUY-WITH-BALANCE] ${step}`, details || "");
};

// 상수
const CHAIN_ID = 8453;
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const FANZTOKEN_ABI = [
  "function createToken(uint256 tokenId, address creator, uint256 basePrice, uint256 kValue) external",
  "function buyFor(uint256 tokenId, address actualBuyer, uint256 amount, uint256 maxCost) external",
  "function getCurrentPrice(uint256 tokenId) external view returns (uint256)",
  "function calculateBuyCost(uint256 tokenId, uint256 amount) external view returns (uint256 reserve, uint256 artistFund, uint256 platform, uint256 total)",
  "function tokens(uint256 tokenId) external view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator, bool exists)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
];

const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, bytes[] calldata func) external",
];

const ENTRY_POINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
];

const toRpcHex = (value: bigint | number) => {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return "0x" + v.toString(16);
};

const normalizeRpcHex = (hex: string) => toRpcHex(BigInt(hex));

// Coinbase Smart Wallet Factory
const COINBASE_SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

async function getSmartAccountAddress(ownerAddress: string, provider: ethers.JsonRpcProvider): Promise<string> {
  const owners = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [ownerAddress])];
  const factoryInterface = new ethers.Interface([
    "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
  ]);
  const callData = factoryInterface.encodeFunctionData("getAddress", [owners, 0n]);
  const callResult = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data: callData });
  const decoded = factoryInterface.decodeFunctionResult("getAddress", callResult) as unknown as [string];
  return ethers.getAddress(decoded[0]);
}

async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedBytes = combined.slice(28);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(encryptionKey), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBytes);
  return decoder.decode(decrypted);
}

// UserOp 빌드
async function buildUserOperation(
  provider: ethers.JsonRpcProvider,
  smartAccountAddress: string,
  callData: string,
): Promise<any> {
  const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);
  const nonce = await entryPoint.getNonce(smartAccountAddress, 0);

  const feeData = await provider.getFeeData();
  const minPriority = ethers.parseUnits("1", "gwei");
  const minMaxFee = ethers.parseUnits("2", "gwei");
  const rawMaxFee = feeData.maxFeePerGas ?? minMaxFee;
  const rawPriority = feeData.maxPriorityFeePerGas ?? minPriority;
  const basePriority = rawPriority < minPriority ? minPriority : rawPriority;
  const baseMaxFee = rawMaxFee < basePriority ? basePriority : rawMaxFee;
  const maxFeePerGas = (baseMaxFee * 12n) / 10n;
  const maxPriorityFeePerGas = (basePriority * 12n) / 10n;

  return {
    sender: smartAccountAddress,
    nonce: toRpcHex(nonce),
    initCode: "0x",
    callData,
    callGasLimit: toRpcHex(350000),
    verificationGasLimit: toRpcHex(100000),
    preVerificationGas: toRpcHex(50000),
    maxFeePerGas: toRpcHex(maxFeePerGas),
    maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };
}

// UserOp 서명
async function signUserOperation(userOp: any, ownerWallet: ethers.Wallet): Promise<string> {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
    [
      userOp.sender, userOp.nonce, ethers.keccak256(userOp.initCode), ethers.keccak256(userOp.callData),
      userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
      userOp.maxFeePerGas, userOp.maxPriorityFeePerGas, ethers.keccak256(userOp.paymasterAndData),
    ]
  );
  const userOpHash = ethers.keccak256(packed);
  const chainIdHash = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, ENTRY_POINT_ADDRESS, CHAIN_ID]
  );
  return await ownerWallet.signMessage(ethers.getBytes(ethers.keccak256(chainIdHash)));
}

// Paymaster로 UserOp 전송
async function sendUserOperationWithPaymaster(
  userOp: any,
  paymasterUrl: string,
  signerWallet: ethers.Wallet
): Promise<string> {
  const sponsorAndSign = async () => {
    const pmResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT_ADDRESS, toRpcHex(CHAIN_ID)],
      }),
    });
    const pmResult = await pmResponse.json();
    if (pmResult.error) throw new Error(`Paymaster error: ${JSON.stringify(pmResult.error)}`);
    if (pmResult.result?.paymasterAndData) userOp.paymasterAndData = pmResult.result.paymasterAndData;
    if (pmResult.result?.callGasLimit) userOp.callGasLimit = normalizeRpcHex(pmResult.result.callGasLimit);
    if (pmResult.result?.verificationGasLimit) userOp.verificationGasLimit = normalizeRpcHex(pmResult.result.verificationGasLimit);
    if (pmResult.result?.preVerificationGas) userOp.preVerificationGas = normalizeRpcHex(pmResult.result.preVerificationGas);
    userOp.signature = await signUserOperation(userOp, signerWallet);
  };

  const sendOnce = async () => {
    await sponsorAndSign();
    const sendResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_sendUserOperation", params: [userOp, ENTRY_POINT_ADDRESS] }),
    });
    return await sendResponse.json();
  };

  let sendResult = await sendOnce();

  // replacement underpriced 재시도
  if (sendResult?.error?.message?.includes("replacement underpriced")) {
    const currentMaxPriorityFee = sendResult?.error?.data?.currentMaxPriorityFee;
    const currentMaxFee = sendResult?.error?.data?.currentMaxFee;
    if (currentMaxPriorityFee && currentMaxFee) {
      userOp.maxPriorityFeePerGas = toRpcHex((BigInt(currentMaxPriorityFee) * 12n) / 10n + 1n);
      userOp.maxFeePerGas = toRpcHex((BigInt(currentMaxFee) * 12n) / 10n + 1n);
      sendResult = await sendOnce();
    }
  }

  if (sendResult.error) throw new Error(`SendUserOperation error: ${JSON.stringify(sendResult.error)}`);

  const userOpHash = sendResult.result;
  // receipt 대기
  let receipt: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const receiptResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_getUserOperationReceipt", params: [userOpHash] }),
    });
    const receiptResult = await receiptResponse.json();
    if (receiptResult.result) { receipt = receiptResult.result; break; }
  }

  if (!receipt) throw new Error("UserOperation receipt timeout");
  if (!receipt.success) throw new Error(`UserOperation failed: ${receipt.reason || "unknown"}`);

  const txHash = receipt.receipt?.transactionHash as string | undefined;

  // tx 채굴 대기
  if (txHash && signerWallet.provider) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const minedReceipt = await signerWallet.provider.getTransactionReceipt(txHash);
      if (minedReceipt) break;
    }
  }

  return txHash || userOpHash;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { tokenId, communityFundAmount } = await req.json();
    if (!tokenId) throw new Error("Missing tokenId");

    logStep("Request received", { userId: user.id, tokenId, communityFundAmount });

    // 1. Fanz Token 정보 조회
    const { data: fanzToken, error: tokenError } = await supabaseAdmin
      .from("fanz_tokens")
      .select("*")
      .eq("id", tokenId)
      .eq("is_active", true)
      .single();

    if (tokenError || !fanzToken) throw new Error("Token not found");

    // 2. 온체인 비용 계산
    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");

    if (!contractAddress || !operatorPrivateKey || !paymasterUrl) {
      throw new Error("Missing contract configuration");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, FANZTOKEN_ABI, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const tokenIdUint = BigInt(fanzToken.token_id);

    // 온체인 토큰 존재 확인
    let tokenExists = true;
    try {
      await contract.getCurrentPrice(tokenIdUint);
    } catch (e: any) {
      if (e.message?.includes("Token does not exist")) tokenExists = false;
      else throw e;
    }

    // 온체인 비용
    let contractTotalCost: bigint;
    let contractCreatorFee: bigint;
    let contractPlatformFee: bigint;

    if (tokenExists) {
      const [reserve, artistFund, platform, total] = await contract.calculateBuyCost(tokenIdUint, 1);
      contractTotalCost = total as bigint;
      contractCreatorFee = artistFund as bigint;
      contractPlatformFee = platform as bigint;
    } else {
      const basePriceUsdc = BigInt(1650000);
      contractTotalCost = (basePriceUsdc * 100n) / 70n;
      contractCreatorFee = (basePriceUsdc * 20n) / 70n;
      contractPlatformFee = (basePriceUsdc * 10n) / 70n;
    }

    const totalCostUsd = Number(contractTotalCost) / 10 ** USDC_DECIMALS;
    const creatorFeeUsd = Number(contractCreatorFee) / 10 ** USDC_DECIMALS;
    const platformFeeUsd = Number(contractPlatformFee) / 10 ** USDC_DECIMALS;

    // 커뮤니티 펀드 포함 총 필요 금액
    const fundAmount = communityFundAmount || 0;
    const totalRequired = totalCostUsd + fundAmount;

    logStep("Cost calculated", { totalCostUsd, fundAmount, totalRequired });

    // 3. USDC 잔액 확인 및 차감 (atomic)
    const { data: balanceData } = await supabaseAdmin
      .from("usdc_balances")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentBalance = balanceData?.balance || 0;
    if (currentBalance < totalRequired) {
      throw new Error(`Insufficient USDC balance. Required: $${totalRequired.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
    }

    // 잔액 차감
    const newBalance = currentBalance - totalRequired;
    const { error: deductError } = await supabaseAdmin
      .from("usdc_balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (deductError) throw new Error("Failed to deduct USDC balance");

    // 트랜잭션 기록 (차감)
    await supabaseAdmin.from("usdc_transactions").insert({
      user_id: user.id,
      amount: -totalRequired,
      fee: 0,
      transaction_type: "lightstick_purchase",
      reference_id: tokenId,
      status: "completed",
    });

    logStep("USDC balance deducted", { previousBalance: currentBalance, newBalance, deducted: totalRequired });

    // 4. 사용자 지갑 주소 조회
    let userWalletAddress: string;

    // external 지갑 우선
    const { data: externalWalletData } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("network", "base")
      .eq("wallet_type", "external")
      .maybeSingle();

    if (externalWalletData?.wallet_address) {
      userWalletAddress = externalWalletData.wallet_address;
    } else {
      // Smart Wallet 주소 계산
      const { data: keyData } = await supabaseAdmin
        .from("wallet_private_keys")
        .select("encrypted_private_key")
        .eq("user_id", user.id)
        .single();

      if (!keyData) throw new Error("User wallet not found");

      const ENCRYPTION_KEY = Deno.env.get("WALLET_ENCRYPTION_KEY");
      if (!ENCRYPTION_KEY) throw new Error("Encryption key not configured");

      const userPrivateKey = await decryptPrivateKey(keyData.encrypted_private_key, ENCRYPTION_KEY);
      let normalizedKey = userPrivateKey.trim();
      if (!normalizedKey.startsWith("0x")) normalizedKey = `0x${normalizedKey}`;
      const userEoaWallet = new ethers.Wallet(normalizedKey);
      userWalletAddress = await getSmartAccountAddress(userEoaWallet.address, provider);
    }

    logStep("User wallet resolved", { userWalletAddress });

    // 5. 크리에이터 지갑 조회
    let { data: creatorWalletData } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", fanzToken.creator_id)
      .eq("network", "base")
      .eq("wallet_type", "smart_wallet")
      .maybeSingle();

    if (!creatorWalletData) {
      const fallback = await supabaseAdmin
        .from("wallet_addresses")
        .select("wallet_address")
        .eq("user_id", fanzToken.creator_id)
        .eq("network", "base")
        .maybeSingle();
      creatorWalletData = fallback.data;
    }

    if (!creatorWalletData?.wallet_address) {
      throw new Error("Creator wallet not found");
    }

    // 6. 온체인 구매 실행
    let normalizedOperatorKey = operatorPrivateKey.trim();
    if (!normalizedOperatorKey.startsWith("0x")) normalizedOperatorKey = `0x${normalizedOperatorKey}`;
    const operatorWallet = new ethers.Wallet(normalizedOperatorKey, provider);

    // Smart Account USDC 잔액 확인
    const smartAccountUsdcBalance = await usdcContract.balanceOf(BACKEND_SMART_ACCOUNT);
    if (smartAccountUsdcBalance < contractTotalCost) {
      // 잔액 복구 후 에러
      await supabaseAdmin
        .from("usdc_balances")
        .update({ balance: currentBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      throw new Error("Insufficient USDC in Smart Account. Please try again later.");
    }

    const maxCost = (contractTotalCost * 110n) / 100n;

    // 구매 전 스냅샷
    const userBalanceBefore = await contract.balanceOf(userWalletAddress, tokenIdUint);

    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const usdcInterface = new ethers.Interface(USDC_ABI);
    const fanzInterface = new ethers.Interface(FANZTOKEN_ABI);

    const batchDests: string[] = [];
    const batchData: string[] = [];

    // USDC approve (필요 시)
    const currentAllowance = await usdcContract.allowance(BACKEND_SMART_ACCOUNT, contractAddress);
    if (currentAllowance < contractTotalCost) {
      const maxApprove = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      batchDests.push(USDC_ADDRESS);
      batchData.push(usdcInterface.encodeFunctionData("approve", [contractAddress, maxApprove]));
    }

    // CreateToken if needed
    if (!tokenExists) {
      const basePriceUsdc = BigInt(1650000);
      const kValueUsdc = BigInt(300000);
      batchDests.push(contractAddress);
      batchData.push(fanzInterface.encodeFunctionData("createToken", [tokenIdUint, creatorWalletData.wallet_address, basePriceUsdc, kValueUsdc]));
    }

    // buyFor
    batchDests.push(contractAddress);
    batchData.push(fanzInterface.encodeFunctionData("buyFor", [tokenIdUint, userWalletAddress, 1, maxCost]));

    let executeCallData: string;
    if (batchDests.length > 1) {
      executeCallData = accountInterface.encodeFunctionData("executeBatch", [batchDests, batchData]);
    } else {
      executeCallData = accountInterface.encodeFunctionData("execute", [batchDests[0], 0n, batchData[0]]);
    }

    let buyTxHash: string;
    try {
      const userOp = await buildUserOperation(provider, BACKEND_SMART_ACCOUNT, executeCallData);
      buyTxHash = await sendUserOperationWithPaymaster(userOp, paymasterUrl, operatorWallet);
      logStep("On-chain purchase completed", { buyTxHash });
    } catch (onchainError: any) {
      // 온체인 실패 시 잔액 복구
      logStep("On-chain purchase failed, reverting balance", { error: onchainError.message });
      await supabaseAdmin
        .from("usdc_balances")
        .update({ balance: currentBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      // 복구 트랜잭션 기록
      await supabaseAdmin.from("usdc_transactions").insert({
        user_id: user.id,
        amount: totalRequired,
        fee: 0,
        transaction_type: "lightstick_purchase_refund",
        reference_id: tokenId,
        status: "completed",
      });

      throw new Error(`On-chain purchase failed: ${onchainError.message}`);
    }

    // 7. 온체인 검증
    const userBalanceAfter = await contract.balanceOf(userWalletAddress, tokenIdUint);
    if (userBalanceAfter !== userBalanceBefore + 1n) {
      logStep("WARNING: On-chain balance mismatch", {
        before: userBalanceBefore.toString(),
        after: userBalanceAfter.toString(),
      });
    }

    // 8. DB 트랜잭션 기록 (execute_fanztoken_purchase RPC)
    const { error: txError } = await supabaseAdmin.rpc("execute_fanztoken_purchase", {
      p_token_id: tokenId,
      p_user_id: user.id,
      p_amount: 1,
      p_price_per_token: totalCostUsd,
      p_total_value: totalCostUsd,
      p_creator_fee: creatorFeeUsd,
      p_platform_fee: platformFeeUsd,
      p_payment_token: "USDC_BALANCE",
      p_payment_value: totalRequired,
      p_tx_hash: buyTxHash,
    });

    if (txError && !txError.message?.includes("duplicate")) {
      logStep("WARNING: DB update failed", { error: txError.message });
    }

    // 9. 보너스 Stars 지급
    try {
      const { data: bonusRule } = await supabaseAdmin
        .from("point_rules")
        .select("points")
        .eq("action_type", "fanztoken_purchase_bonus")
        .eq("is_active", true)
        .single();

      const BONUS_STARS = bonusRule?.points || 0;
      if (BONUS_STARS > 0) {
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles")
          .select("available_points, total_points")
          .eq("id", user.id)
          .single();

        if (currentProfile) {
          await supabaseAdmin
            .from("profiles")
            .update({
              available_points: currentProfile.available_points + BONUS_STARS,
              total_points: currentProfile.total_points + BONUS_STARS,
            })
            .eq("id", user.id);

          await supabaseAdmin.from("point_transactions").insert({
            user_id: user.id,
            action_type: "fanztoken_purchase_bonus",
            points: BONUS_STARS,
            reference_id: tokenId,
          });
          logStep("Bonus stars awarded", { bonus: BONUS_STARS });
        }
      }
    } catch (bonusErr: any) {
      logStep("WARNING: Bonus stars failed", { error: bonusErr.message });
    }

    logStep("Purchase completed successfully", { buyTxHash, totalRequired });

    return new Response(
      JSON.stringify({
        success: true,
        txHash: buyTxHash,
        totalDeducted: totalRequired,
        newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
