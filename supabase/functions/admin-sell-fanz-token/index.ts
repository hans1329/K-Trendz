import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_MAINNET_RPC = Deno.env.get("BASE_RPC_URL");
const BACKEND_OPERATOR_ADDRESS = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const COINBASE_PAYMASTER_URL = Deno.env.get("COINBASE_PAYMASTER_URL") ?? "";

const FANZTOKEN_ABI = [
  "function sellFor(uint256 tokenId, address actualSeller, uint256 amount, uint256 minRefund) external",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function calculateSellRefund(uint256 tokenId, uint256 amount) view returns (uint256 grossRefund, uint256 platformFee, uint256 netRefund)",
];

const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function getNonce() view returns (uint256)",
];

const ENTRYPOINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callDataGas, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
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
  return "0x" + hex;
}

function logStep(step: string, details?: unknown) {
  console.log(`[admin-sell-fanz-token] ${step}`, details ? JSON.stringify(details) : "");
}

async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const keyBuffer = Uint8Array.from(atob(encryptionKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encrypted);
  return new TextDecoder().decode(decrypted);
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    // Admin check - query user_roles table directly
    const { data: adminCheck } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminCheck) throw new Error("Admin access required");

    const { tokenId, fromAddress, amount } = await req.json();

    if (!tokenId || !fromAddress || !amount) {
      throw new Error("Missing required fields: tokenId, fromAddress, amount");
    }

    logStep("Sell request", { tokenId, fromAddress, amount });

    if (!BASE_MAINNET_RPC) {
      throw new Error("BASE_RPC_URL not configured");
    }
    if (!COINBASE_PAYMASTER_URL) {
      throw new Error("COINBASE_PAYMASTER_URL not configured");
    }

    const provider = new ethers.JsonRpcProvider(BASE_MAINNET_RPC);
    const chainId = 8453n;

    const FANZTOKEN_CONTRACT = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    if (!FANZTOKEN_CONTRACT) throw new Error("FANZTOKEN_CONTRACT_ADDRESS not configured");

    const fanzTokenContract = new ethers.Contract(FANZTOKEN_CONTRACT, FANZTOKEN_ABI, provider);
    const fromAddr = ethers.getAddress(fromAddress);

    // Check balance
    const balance = await fanzTokenContract.balanceOf(fromAddr, tokenId);
    logStep("Current balance", { fromAddress: fromAddr, balance: balance.toString() });

    if (balance < BigInt(amount)) {
      throw new Error(`Insufficient balance. Has ${balance.toString()}, needs ${amount}`);
    }

    // Calculate sell refund
    const [grossRefund, platformFee, netRefund] = await fanzTokenContract.calculateSellRefund(tokenId, amount);
    logStep("Sell refund calculation", {
      grossRefund: ethers.formatUnits(grossRefund, 6),
      platformFee: ethers.formatUnits(platformFee, 6),
      netRefund: ethers.formatUnits(netRefund, 6),
    });

    // Backend operator setup
    const operatorKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    if (!operatorKey) throw new Error("BASE_OPERATOR_PRIVATE_KEY not configured");

    const operatorWallet = new ethers.Wallet(operatorKey, provider);
    const operatorEOA = operatorWallet.address;
    logStep("Operator EOA", operatorEOA);

    // Build sellFor calldata
    // sellFor(uint256 tokenId, address actualSeller, uint256 amount, uint256 minRefund)
    const sellForData = fanzTokenContract.interface.encodeFunctionData("sellFor", [
      tokenId,
      fromAddr,
      amount,
      0, // minRefund = 0 for admin operation
    ]);

    // SimpleAccount execute calldata
    const simpleAccountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const executeCallData = simpleAccountIface.encodeFunctionData("execute", [
      FANZTOKEN_CONTRACT,
      0,
      sellForData,
    ]);

    // Get nonce from EntryPoint
    const entryPointContract = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
    const nonce = await entryPointContract.getNonce(BACKEND_OPERATOR_ADDRESS, 0);
    logStep("Backend operator nonce", nonce.toString());

    // Gas prices
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 12n) / 10n : ethers.parseUnits("3", "gwei");
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
      ? (feeData.maxPriorityFeePerGas * 12n) / 10n
      : ethers.parseUnits("1", "gwei");

    // Build UserOperation
    let userOp: UserOperation = {
      sender: BACKEND_OPERATOR_ADDRESS,
      nonce: toRpcHex(nonce),
      initCode: "0x",
      callData: executeCallData + BUILDER_CODE_SUFFIX,
      callGasLimit: toRpcHex(300000),
      verificationGasLimit: toRpcHex(150000),
      preVerificationGas: toRpcHex(50000),
      maxFeePerGas: toRpcHex(maxFeePerGas),
      maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Get paymaster sponsorship
    const paymasterResponse = await fetch(COINBASE_PAYMASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pm_getPaymasterData",
        params: [userOp, ENTRYPOINT_ADDRESS, toRpcHex(chainId)],
      }),
    });

    const paymasterResult = await paymasterResponse.json();
    if (paymasterResult.error) {
      throw new Error(`Paymaster error: ${JSON.stringify(paymasterResult.error)}`);
    }

    logStep("Paymaster response", paymasterResult.result);

    userOp.paymasterAndData = paymasterResult.result.paymasterAndData;
    if (paymasterResult.result.callGasLimit) userOp.callGasLimit = paymasterResult.result.callGasLimit;
    if (paymasterResult.result.verificationGasLimit) userOp.verificationGasLimit = paymasterResult.result.verificationGasLimit;
    if (paymasterResult.result.preVerificationGas) userOp.preVerificationGas = paymasterResult.result.preVerificationGas;

    // Sign UserOperation
    const userOpHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        [
          userOp.sender,
          userOp.nonce,
          ethers.keccak256(userOp.initCode),
          ethers.keccak256(userOp.callData),
          userOp.callGasLimit,
          userOp.verificationGasLimit,
          userOp.preVerificationGas,
          userOp.maxFeePerGas,
          userOp.maxPriorityFeePerGas,
          ethers.keccak256(userOp.paymasterAndData),
        ]
      )
    );

    const finalHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [userOpHash, ENTRYPOINT_ADDRESS, chainId]
      )
    );

    const signature = await operatorWallet.signMessage(ethers.getBytes(finalHash));
    userOp.signature = signature;

    logStep("UserOp signed, submitting to bundler");

    // Submit to bundler
    const bundlerResponse = await fetch(COINBASE_PAYMASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRYPOINT_ADDRESS],
      }),
    });

    const bundlerResult = await bundlerResponse.json();
    if (bundlerResult.error) {
      throw new Error(`Bundler error: ${JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashFromBundler = bundlerResult.result;
    logStep("UserOp submitted", { userOpHash: userOpHashFromBundler });

    // Wait for receipt
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const receiptResponse = await fetch(COINBASE_PAYMASTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getUserOperationReceipt",
          params: [userOpHashFromBundler],
        }),
      });

      const receiptResult = await receiptResponse.json();
      if (receiptResult.result) {
        receipt = receiptResult.result;
        break;
      }
    }

    if (!receipt) {
      throw new Error("Transaction receipt not found within timeout");
    }

    const txHash = receipt.receipt?.transactionHash ?? null;
    const userOpSucceeded = receipt.success === true || receipt.success === "0x1" || receipt.success === 1;

    logStep("Transaction completed", { txHash, success: receipt.success });

    // Check new balance
    const newBalance = await fanzTokenContract.balanceOf(fromAddr, tokenId);

    if (!userOpSucceeded) {
      return new Response(
        JSON.stringify({
          success: false,
          txHash,
          newBalance: newBalance.toString(),
          netRefund: ethers.formatUnits(netRefund, 6),
          error: "UserOperation failed (receipt.success=false)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        newBalance: newBalance.toString(),
        netRefund: ethers.formatUnits(netRefund, 6),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: errMsg });
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
