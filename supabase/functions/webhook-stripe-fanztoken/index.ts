import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.7.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const logStep = (step: string, details?: any) => {
  console.log(`[WEBHOOK-FANZTOKEN] ${step}`, details || '');
};

// Base Mainnet Chain ID
const CHAIN_ID = 8453;
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Backend Smart Account (SimpleAccount) - 운영 주소 고정
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// USDC Contract ABI (Base Mainnet)
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// FanzTokenUSDC V4 Contract ABI
const FANZTOKEN_ABI = [
  "function createToken(uint256 tokenId, address creator, uint256 basePrice, uint256 kValue) external",
  "function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external",
  // V4: buyFor(uint256 tokenId, address actualBuyer, uint256 amount, uint256 maxCost)
  "function buyFor(uint256 tokenId, address actualBuyer, uint256 amount, uint256 maxCost) external",
  "function sell(uint256 tokenId, uint256 amount, uint256 minRefund) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
  "function getCurrentPrice(uint256 tokenId) external view returns (uint256)",
  // V4: calculateBuyCost returns 4 values (reserve, artistFund, platform, total)
  "function calculateBuyCost(uint256 tokenId, uint256 amount) external view returns (uint256 reserve, uint256 artistFund, uint256 platform, uint256 total)",
  "function tokens(uint256 tokenId) external view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator, bool exists)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)"
];

// Coinbase Smart Wallet Factory (Base Mainnet) - matches get-backend-smart-account
const COINBASE_SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";
const COINBASE_IMPLEMENTATION = "0x000100abaad02f1cfC8Bbe32bD5a564817339E72";

// Simple Account ABI for execute
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  // - Backend Smart Account(SimpleAccount)의 표준 배치 인터페이스(2-인자)로 맞춤
  // - CDP Paymaster가 calldata를 파싱/시뮬레이션할 때 이 시그니처를 기준으로 allowlist를 적용함
  "function executeBatch(address[] calldata dest, bytes[] calldata func) external",
  "function getNonce() view returns (uint256)",
];

// EntryPoint ABI for getNonce
const ENTRY_POINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)"
];

// Standard ERC1967Proxy creation code (from OpenZeppelin)
const PROXY_CREATION_CODE = "0x608060405260405161046c38038061046c83398101604081905261002291610249565b61002e82826000610035565b505061030e565b61003e83610061565b60008251118061004b5750805b1561005c5761005a83836100a1565b505b505050565b61006a816100cd565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606100c6838360405180606001604052806027815260200161044560279139610161565b9392505050565b6001600160a01b0381163b61013f5760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084015b60405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0392909216919091179055565b6060600080856001600160a01b03168560405161017e91906102bf565b600060405180830381855af49150503d80600081146101b9576040519150601f19603f3d011682016040523d82523d6000602084013e6101be565b606091505b5090925090506101d0868383876101da565b9695505050505050565b60608315610246578251610239576001600160a01b0385163b6102395760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e74726163740000006044820152606401610136565b5081610250565b6102508383610258565b949350505050565b8151156102685781518083602001fd5b8060405162461bcd60e51b81526004016101369190906102db565b634e487b7160e01b600052604160045260246000fd5b60005b838110156102b457818101518382015260200161029c565b50506000910152565b600082516102cf818460208701610299565b9190910192915050565b60208152600082518060208401526102f8816040850160208701610299565b601f01601f19169190910160400192915050565b610128806103206000396000f3fe6080604052366100135761001161001d565b005b61001b61001d565b005b610025610035565b61003561003061008c565b610095565b565b3660008037600080366000845af43d6000803e808015610056573d6000f35b3d6000fd5b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc610087836100b9565b905090565b6000610087610121565b3660008037600080366000845af43d6000803e8080156100b4573d6000f35b3d6000fd5b6000806100c583610121565b9050806001600160a01b03163b6000036101175760405162461bcd60e51b815260206004820152600e60248201526d1393d517d355531317d05353d5d560921b604482015260640160405180910390fd5b919050565b60006100877f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490565b416464726573733a2064656c656761746563616c6c20746f206e6f6e2d636f6e7472616374000000";

// JSON-RPC quantity hex helper (no leading zeros, e.g. 0xc3500 not 0x0c3500)
const toRpcHex = (value: bigint | number) => {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return "0x" + v.toString(16);
};

// Normalize a hex quantity string (handles leading zeros from some sources)
const normalizeRpcHex = (hex: string) => toRpcHex(BigInt(hex));

// Get Smart Account address from EOA using Coinbase Smart Wallet Factory getAddress call
// NOTE: 로컬 CREATE2 계산은 바이트코드 차이로 주소 불일치 리스크가 있어, Factory를 진실의 소스로 사용
async function getSmartAccountAddress(ownerAddress: string, provider: ethers.JsonRpcProvider): Promise<string> {
  // create-smart-wallet과 동일한 방식: owners를 bytes[]로 인코딩
  const owners = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [ownerAddress])];
  const nonce = 0n;

  const factoryInterface = new ethers.Interface([
    "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
  ]);

  const callData = factoryInterface.encodeFunctionData("getAddress", [owners, nonce]);
  const callResult = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data: callData });
  const decoded = factoryInterface.decodeFunctionResult("getAddress", callResult) as unknown as [string];

  return ethers.getAddress(decoded[0]);
}

// Build UserOperation for Paymaster execution
async function buildUserOperation(
  provider: ethers.JsonRpcProvider,
  smartAccountAddress: string,
  callData: string,
  ownerWallet: ethers.Wallet
): Promise<any> {
  const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);
  
  // Get nonce from EntryPoint
  const nonce = await entryPoint.getNonce(smartAccountAddress, 0);
  
  // Check if account is deployed
  const code = await provider.getCode(smartAccountAddress);
  const isDeployed = code !== "0x";
  
  // If not deployed, create initCode using Coinbase Smart Wallet Factory
  let initCode = "0x";
  if (!isDeployed) {
    const owners = [ownerWallet.address];
    const nonce = 0n;
    
    const abiCoder = new ethers.AbiCoder();
    const encodedOwnersAndNonce = abiCoder.encode(["address[]", "uint256"], [owners, nonce]);
    
    const factoryInterface = new ethers.Interface([
      "function createAccount(address[] calldata owners, uint256 nonce) external returns (address)"
    ]);
    const factoryCallData = factoryInterface.encodeFunctionData("createAccount", [owners, nonce]);
    initCode = ethers.concat([COINBASE_SMART_WALLET_FACTORY, factoryCallData]);
  }
  
  // Get gas prices (번들러 replacement underpriced 방지를 위해 최소값 + 버퍼 적용)
  const feeData = await provider.getFeeData();

  // NOTE: Base 메인넷에서 일부 번들러는 최소 1 gwei 수준을 요구하는 경우가 있어, 하한선을 둔다.
  const minPriority = ethers.parseUnits("1", "gwei");
  const minMaxFee = ethers.parseUnits("2", "gwei");

  const rawMaxFee = feeData.maxFeePerGas ?? minMaxFee;
  const rawPriority = feeData.maxPriorityFeePerGas ?? minPriority;

  const basePriority = rawPriority < minPriority ? minPriority : rawPriority;
  const baseMaxFee = rawMaxFee < basePriority ? basePriority : rawMaxFee;

  // 20% buffer
  const maxFeePerGas = (baseMaxFee * 12n) / 10n;
  const maxPriorityFeePerGas = (basePriority * 12n) / 10n;
  
  // NOTE: JSON-RPC quantity fields must NOT have leading zeros (0xc3500, not 0x0c3500)
  // 가스 리밋 최적화: executeBatch 사용 시 350K면 충분 (approve + buyFor)
  const userOp = {
    sender: smartAccountAddress,
    nonce: toRpcHex(nonce),
    initCode: initCode,
    callData: callData,
    callGasLimit: toRpcHex(350000), // Optimized for executeBatch (approve + buyFor)
    verificationGasLimit: toRpcHex(isDeployed ? 100000 : 400000),
    preVerificationGas: toRpcHex(50000),
    maxFeePerGas: toRpcHex(maxFeePerGas),
    maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };
  
  return userOp;
}

// Sign UserOperation
async function signUserOperation(userOp: any, ownerWallet: ethers.Wallet): Promise<string> {
  // Pack UserOp for hashing
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
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
      ethers.keccak256(userOp.paymasterAndData)
    ]
  );
  
  const userOpHash = ethers.keccak256(packed);
  const chainIdHash = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, ENTRY_POINT_ADDRESS, CHAIN_ID]
  );
  const finalHash = ethers.keccak256(chainIdHash);
  
  const signature = await ownerWallet.signMessage(ethers.getBytes(finalHash));
  return signature;
}

// Send UserOperation via Bundler with Paymaster
async function sendUserOperationWithPaymaster(
  userOp: any,
  paymasterUrl: string,
  signerWallet: ethers.Wallet
): Promise<string> {
  const sponsorAndSign = async () => {
    // Step 1: Paymaster sponsorship data 조회 (실제 제출용)
    const paymasterResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT_ADDRESS, toRpcHex(CHAIN_ID)],
      }),
    });

    const paymasterResult = await paymasterResponse.json();
    logStep("Paymaster data response", paymasterResult);

    if (paymasterResult.error) {
      throw new Error(`Paymaster data error: ${JSON.stringify(paymasterResult.error)}`);
    }

    // Apply paymaster data (normalize any hex quantities to avoid leading zeros)
    if (paymasterResult.result?.paymasterAndData) {
      userOp.paymasterAndData = paymasterResult.result.paymasterAndData;
    }
    if (paymasterResult.result?.callGasLimit) {
      userOp.callGasLimit = normalizeRpcHex(paymasterResult.result.callGasLimit);
    }
    if (paymasterResult.result?.verificationGasLimit) {
      userOp.verificationGasLimit = normalizeRpcHex(paymasterResult.result.verificationGasLimit);
    }
    if (paymasterResult.result?.preVerificationGas) {
      userOp.preVerificationGas = normalizeRpcHex(paymasterResult.result.preVerificationGas);
    }

    // PaymasterAndData가 포함된 최종 UserOp로 다시 서명 (ERC-191)
    userOp.signature = await signUserOperation(userOp, signerWallet);
  };

  const sendOnce = async () => {
    await sponsorAndSign();

    // Step 2: Send UserOperation
    const sendResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRY_POINT_ADDRESS],
      }),
    });

    const sendResult = await sendResponse.json();
    logStep("Send UserOp response", sendResult);
    return sendResult;
  };

  let sendResult = await sendOnce();

  // NOTE: 같은 nonce의 pending UserOp가 있을 때, 번들러가 replacement underpriced로 거절할 수 있음.
  // 이 경우 번들러가 요구하는 currentMaxFee/currentMaxPriorityFee 기준으로 20% 상향하여 1회 재시도.
  if (sendResult?.error?.message?.includes("replacement underpriced")) {
    const currentMaxPriorityFee = sendResult?.error?.data?.currentMaxPriorityFee as string | undefined;
    const currentMaxFee = sendResult?.error?.data?.currentMaxFee as string | undefined;

    if (currentMaxPriorityFee && currentMaxFee) {
      const bumpedPriority = (BigInt(currentMaxPriorityFee) * 12n) / 10n + 1n;
      const bumpedMaxFee = (BigInt(currentMaxFee) * 12n) / 10n + 1n;

      userOp.maxPriorityFeePerGas = toRpcHex(bumpedPriority);
      userOp.maxFeePerGas = toRpcHex(bumpedMaxFee);

      logStep("Retrying UserOp with bumped fees", {
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        maxFeePerGas: userOp.maxFeePerGas,
      });

      sendResult = await sendOnce();
    }
  }

  if (sendResult.error) {
    throw new Error(`SendUserOperation error: ${JSON.stringify(sendResult.error)}`);
  }

  const userOpHash = sendResult.result;
  // Step 3: Wait for UserOperation receipt (bundler-level)
  let receipt: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const receiptResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      }),
    });

    const receiptResult = await receiptResponse.json();
    if (receiptResult.result) {
      receipt = receiptResult.result;
      break;
    }
  }

  if (!receipt) {
    throw new Error("UserOperation receipt timeout");
  }

  if (!receipt.success) {
    throw new Error(`UserOperation failed: ${receipt.reason || "unknown"}`);
  }

  const txHash = receipt.receipt?.transactionHash as string | undefined;

  // NOTE: 일부 번들러는 userOp receipt를 먼저 주고, 실제 tx inclusion은 지연될 수 있음.
  // 다음 UserOp가 같은 nonce로 "replacement underpriced"가 나는 것을 막기 위해 tx가 채굴될 때까지 대기.
  if (txHash && signerWallet.provider) {
    let minedReceipt: any = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      minedReceipt = await signerWallet.provider.getTransactionReceipt(txHash);
      if (minedReceipt) break;
    }

    if (!minedReceipt) {
      throw new Error("Transaction receipt timeout");
    }
  }

  return txHash || userOpHash;
}

// Burn tokens and recover USDC for refunded purchases using Backend Smart Account delegation (V5 sellFor)
async function burnTokensForRefund(
  userId: string,
  tokenId: string,
  amount: number,
  contractAddress: string,
  supabaseClient: any
): Promise<void> {
  const RPC_URL = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
  const PAYMASTER_URL = Deno.env.get('COINBASE_PAYMASTER_URL');
  const OPERATOR_PRIVATE_KEY = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
  
  if (!OPERATOR_PRIVATE_KEY) {
    throw new Error('Operator private key not configured');
  }
  
  if (!PAYMASTER_URL) {
    throw new Error('Paymaster URL not configured');
  }

  logStep("Starting token burn via Backend delegation", { userId, tokenId, amount });

  // Get user's wallet address from database
  const { data: walletData, error: walletError } = await supabaseClient
    .from('wallet_addresses')
    .select('wallet_address')
    .eq('user_id', userId)
    .single();

  if (walletError || !walletData) {
    throw new Error(`User wallet not found: ${walletError?.message}`);
  }

  const userWalletAddress = walletData.wallet_address;
  logStep("User wallet for burn", { userWalletAddress });

  // Initialize provider and operator wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let normalizedKey = OPERATOR_PRIVATE_KEY.trim();
  if (!normalizedKey.startsWith("0x")) {
    normalizedKey = `0x${normalizedKey}`;
  }
  const operatorWallet = new ethers.Wallet(normalizedKey, provider);

  // Use V5 sellFor - Backend Smart Account sells on behalf of user
  // sellFor(uint256 tokenId, uint256 amount, uint256 minRefund, address actualUser)
  const sellForInterface = new ethers.Interface([
    "function sellFor(uint256 tokenId, uint256 amount, uint256 minRefund, address actualUser) external"
  ]);
  const sellForCallData = sellForInterface.encodeFunctionData("sellFor", [
    BigInt(tokenId),
    BigInt(amount),
    0n, // minRefund
    userWalletAddress // actualUser - the user whose tokens are being sold
  ]);
  
  // Wrap in Backend Smart Account execute call
  const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  const executeCallData = accountInterface.encodeFunctionData("execute", [
    contractAddress,
    0n,
    sellForCallData
  ]);

  // Build UserOperation for Backend Smart Account (no initCode needed - already deployed)
  const backendAccountAddress = BACKEND_SMART_ACCOUNT;
  
  // Get nonce
  const entryPointContract = new ethers.Contract(
    ENTRY_POINT_ADDRESS,
    ENTRY_POINT_ABI,
    provider
  );
  const nonce = await entryPointContract.getNonce(backendAccountAddress, 0);
  
  // Get gas fees
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : ethers.parseUnits("3", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 120n) / 100n : ethers.parseUnits("1", "gwei");

  const userOp = {
    sender: backendAccountAddress,
    nonce: toRpcHex(nonce),
    initCode: "0x",
    callData: executeCallData + BUILDER_CODE_SUFFIX,
    callGasLimit: toRpcHex(300000n),
    verificationGasLimit: toRpcHex(150000n),
    preVerificationGas: toRpcHex(50000n),
    maxFeePerGas: toRpcHex(maxFeePerGas),
    maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };

  const txHash = await sendUserOperationWithPaymaster(userOp, PAYMASTER_URL, operatorWallet);
  logStep("Tokens burned via Backend delegation", { txHash });

  // Update database balance
  const { data: fanzToken } = await supabaseClient
    .from('fanz_tokens')
    .select('id')
    .eq('token_id', tokenId)
    .single();

  if (fanzToken) {
    const { error: balanceError } = await supabaseClient
      .from('fanz_balances')
      .update({ 
        balance: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('fanz_token_id', fanzToken.id);

    if (balanceError) {
      logStep("WARNING: Failed to update balance", { error: balanceError.message });
    }
  }

  logStep("Token burn completed successfully");
}

// Decrypt user's private key (Salt 16B + IV 12B + Ciphertext 형식 - create-smart-wallet과 동일)
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  // Salt(16B) + IV(12B) + Ciphertext
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedBytes = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedBytes,
  );

  return decoder.decode(decrypted);
}

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No signature");
    }

    const body = await req.text();
    
    // Stripe 시그니처 검증
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Signature verified", { eventType: event.type, eventId: event.id });
    } catch (err: any) {
      logStep("Signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 환불/차지백 이벤트 처리
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      logStep("Refund/Dispute event received", { eventType: event.type });
      
      // Idempotency: 이미 처리한 환불/분쟁 이벤트인지 확인
      const { data: existingRefundEvent } = await supabaseClient
        .from('stripe_webhook_events')
        .select('id')
        .eq('event_id', event.id)
        .maybeSingle();

      if (existingRefundEvent) {
        logStep("Refund/dispute event already processed", { eventId: event.id });
        return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 });
      }

      // 환불/분쟁 이벤트 기록
      await supabaseClient
        .from('stripe_webhook_events')
        .insert({
          event_id: event.id,
          event_type: event.type,
          metadata: event.data.object as any
        });
      
      const charge = event.data.object as any;
      const paymentIntentId = charge.payment_intent;
      
      if (!paymentIntentId) {
        logStep("No payment_intent found in charge", { chargeId: charge.id });
        return new Response(JSON.stringify({ received: true, error: "No payment_intent" }), { status: 200 });
      }

      // payment_intent_id로 정확한 트랜잭션 찾기
      const { data: transaction } = await supabaseClient
        .from('fanz_transactions')
        .select('id, user_id, fanz_token_id, amount, transaction_type')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .eq('transaction_type', 'buy')
        .maybeSingle();
      
      if (transaction) {
        logStep("Found transaction for refund", { 
          transactionId: transaction.id,
          userId: transaction.user_id,
          paymentIntentId
        });
        
        // Get token details for burn
        const { data: tokenData } = await supabaseClient
          .from('fanz_tokens')
          .select('token_id, contract_address')
          .eq('id', transaction.fanz_token_id)
          .single();
        
        if (!tokenData) {
          logStep("ERROR: Token data not found", { tokenId: transaction.fanz_token_id });
          
          await supabaseClient
            .from('fanz_transactions')
            .update({ transaction_type: 'refunded' })
            .eq('id', transaction.id);
          
          return new Response(JSON.stringify({ received: true, error: "Token not found" }), { status: 200 });
        }
        
        // Attempt automatic token burn
        try {
          logStep("Attempting automatic token burn with Paymaster");
          
          const contractAddress = tokenData.contract_address || Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
          
          await burnTokensForRefund(
            transaction.user_id,
            tokenData.token_id,
            transaction.amount,
            contractAddress,
            supabaseClient
          );
          
          // Update transaction status after successful burn
          await supabaseClient
            .from('fanz_transactions')
            .update({ transaction_type: 'refunded' })
            .eq('id', transaction.id);
          
          logStep("Refund processed with automatic token burn", {
            transactionId: transaction.id,
            userId: transaction.user_id,
            amount: transaction.amount
          });
        } catch (burnError: any) {
          logStep("ERROR: Automatic token burn failed", { 
            error: burnError.message,
            transactionId: transaction.id
          });
          
          // Update transaction status even if burn fails
          await supabaseClient
            .from('fanz_transactions')
            .update({ transaction_type: 'refunded' })
            .eq('id', transaction.id);
          
          logStep("Transaction marked as refunded - ADMIN ACTION REQUIRED", {
            transactionId: transaction.id,
            userId: transaction.user_id,
            fanzTokenId: transaction.fanz_token_id,
            amount: transaction.amount,
            chargeId: charge.id,
            paymentIntentId: paymentIntentId,
            burnError: burnError.message,
            warning: "Automatic token burn failed. Manual review and token recovery needed."
          });
        }
      } else {
        logStep("No transaction found for payment_intent", { paymentIntentId });
      }
      
      return new Response(JSON.stringify({ received: true, refund_logged: true }), { status: 200 });
    }

    // checkout.session.completed 이벤트만 처리
    if (event.type !== "checkout.session.completed") {
      logStep("Event type not handled", { eventType: event.type });
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Idempotency: 이미 처리한 이벤트인지 확인
    const { data: existingEvent } = await supabaseClient
      .from('stripe_webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Event already processed", { eventId: event.id });

      // 중복 delivery의 경우에도 "실제로 온체인에서 mint가 일어났는지" 재검증해서,
      // DB만 기록되고 실제 구매가 누락된 케이스를 자동 환불로 복구한다.
      try {
        const paymentIntentId = session.payment_intent as string | null;

        if (paymentIntentId) {
          const { data: tx } = await supabaseClient
            .from('fanz_transactions')
            .select('id, tx_hash, fanz_token_id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .eq('transaction_type', 'buy')
            .maybeSingle();

          if (tx?.tx_hash) {
            const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            const minedReceipt = await provider.getTransactionReceipt(tx.tx_hash);

            if (minedReceipt) {
              const { data: tokenRow } = await supabaseClient
                .from('fanz_tokens')
                .select('token_id')
                .eq('id', tx.fanz_token_id)
                .maybeSingle();

              if (tokenRow?.token_id) {
                const tokenIdUint = BigInt(tokenRow.token_id);
                const iface = new ethers.Interface(FANZTOKEN_ABI);

                const minted = minedReceipt.logs.some((log: any) => {
                  try {
                    const parsed = iface.parseLog(log);
                    if (!parsed || parsed.name !== 'TransferSingle') return false;

                    const from = parsed.args?.from as string;
                    const to = parsed.args?.to as string;
                    const id = parsed.args?.id as bigint;
                    const value = parsed.args?.value as bigint;

                    return (
                      ethers.getAddress(from) === ethers.ZeroAddress &&
                      ethers.getAddress(to) === ethers.getAddress(BACKEND_SMART_ACCOUNT) &&
                      id === tokenIdUint &&
                      value >= 1n
                    );
                  } catch {
                    return false;
                  }
                });

                if (!minted) {
                  logStep("CRITICAL: Duplicate event but missing mint on-chain - initiating refund", {
                    paymentIntentId,
                    txHash: tx.tx_hash,
                  });

                  try {
                    await stripe.refunds.create({
                      payment_intent: paymentIntentId,
                      reason: 'requested_by_customer',
                      metadata: {
                        reason: 'reconcile_missing_mint',
                        txHash: tx.tx_hash,
                      },
                    });
                  } catch (refundErr: any) {
                    // 이미 환불된 경우 등은 여기로 들어올 수 있으니, 경고 로그만 남긴다.
                    logStep("WARNING: Reconcile refund attempt failed", {
                      paymentIntentId,
                      txHash: tx.tx_hash,
                      error: refundErr?.message,
                    });
                  }
                }
              }
            } else {
              logStep("Reconcile skipped - tx receipt not found yet", { txHash: tx.tx_hash });
            }
          }
        }
      } catch (reconcileErr: any) {
        logStep("WARNING: Reconcile on duplicate event failed", { error: reconcileErr?.message });
      }

      return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 });
    }

    // 이벤트 기록
    await supabaseClient
      .from('stripe_webhook_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        metadata: event.data.object as any
      });
    logStep("Event recorded", { eventId: event.id });

    if (session.payment_status !== "paid") {
      logStep("Payment not completed", { paymentStatus: session.payment_status });
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const { tokenId, userId, priceUsd } = session.metadata as {
      tokenId: string;
      userId: string;
      priceUsd: string;
    };

    if (!tokenId || !userId || !priceUsd) {
      throw new Error("Missing metadata");
    }
    logStep("Payment verified", { tokenId, userId, priceUsd });

    // Fanz Token 구매 로직 시작
    const { data: fanzToken, error: tokenError } = await supabaseClient
      .from('fanz_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (tokenError || !fanzToken) {
      throw new Error('Token not found');
    }
    logStep("Token found", { tokenId, currentSupply: fanzToken.total_supply });

    // USDC 기반이므로 ETH 가격 조회 불필요 - 직접 USD 사용
    const paidUsd = parseFloat(priceUsd);
    logStep("Payment amount (USD = USDC)", { paidUsd });

    // 사용자 지갑 주소 조회
    // 우선순위: external(베이스 지갑) > smart_wallet
    // Farcaster 사용자가 베이스 지갑으로 로그인 후 구매하면, 그 지갑으로 민팅해야
    // 이후 Farcaster에서 같은 지갑으로 참여 시 응원봉 보유자로 인식됨
    let userWalletAddress: string;
    let mintToExternalWallet = false;

    // 1) external 지갑 먼저 확인
    const { data: externalWalletData } = await supabaseClient
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', userId)
      .eq('network', 'base')
      .eq('wallet_type', 'external')
      .maybeSingle();

    if (externalWalletData?.wallet_address) {
      userWalletAddress = externalWalletData.wallet_address;
      mintToExternalWallet = true;
      logStep("Using external wallet for minting (Farcaster compatible)", { userWalletAddress });
    } else {
      // 2) external 없으면 기존 로직: private key에서 Smart Wallet 주소 계산
      const { data: userWalletKeyData, error: userWalletKeyError } = await supabaseClient
        .from('wallet_private_keys')
        .select('encrypted_private_key')
        .eq('user_id', userId)
        .single();

      if (userWalletKeyError || !userWalletKeyData) {
        throw new Error('User wallet private key not found');
      }

      // 스마트 컨트랙트 설정 - provider 먼저 초기화
      const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
      const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // 개인키 복호화 및 Smart Wallet 주소 계산
      const ENCRYPTION_KEY = Deno.env.get('WALLET_ENCRYPTION_KEY');
      if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
      }
      const userPrivateKey = await decryptPrivateKey(userWalletKeyData.encrypted_private_key, ENCRYPTION_KEY);
      let normalizedUserKey = userPrivateKey.trim();
      if (!normalizedUserKey.startsWith("0x")) {
        normalizedUserKey = `0x${normalizedUserKey}`;
      }
      const userEoaWallet = new ethers.Wallet(normalizedUserKey);
      userWalletAddress = await getSmartAccountAddress(userEoaWallet.address, provider);
      logStep("User wallet derived from private key (Smart Wallet)", { 
        userEoaAddress: userEoaWallet.address,
        userSmartWalletAddress: userWalletAddress 
      });
    }

    // 스마트 컨트랙트 설정
    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    const backendPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    // Paymaster(UserOp 서명)용 키: Backend Smart Account(owner) 기준. 운영환경에서는 BASE_OPERATOR_PRIVATE_KEY를 우선 사용.
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY") || backendPrivateKey;
    const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");

    if (!contractAddress || !backendPrivateKey || !operatorPrivateKey) {
      throw new Error("Missing contract configuration");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    logStep("Mint target wallet", { userWalletAddress, mintToExternalWallet });

    // 크리에이터 지갑 주소 조회
    // - 유저가 external + smart_wallet 등 여러 타입을 가질 수 있으므로 single() 금지
    // - 우선 smart_wallet을 조회하고, 없으면 fallback으로 아무 지갑이나 조회
    let { data: creatorWalletData, error: creatorWalletError } = await supabaseClient
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', fanzToken.creator_id)
      .eq('network', 'base')
      .eq('wallet_type', 'smart_wallet')
      .maybeSingle();

    if (!creatorWalletData) {
      const fallback = await supabaseClient
        .from('wallet_addresses')
        .select('wallet_address')
        .eq('user_id', fanzToken.creator_id)
        .eq('network', 'base')
        .maybeSingle();

      creatorWalletData = fallback.data;
      creatorWalletError = creatorWalletError ?? fallback.error;
    }

    if (!creatorWalletData?.wallet_address) {
      logStep("ERROR", {
        message: "Creator wallet not found",
        creatorId: fanzToken.creator_id,
        error: creatorWalletError?.message,
      });
      throw new Error('Creator wallet not found');
    }

    const creatorWalletAddress = creatorWalletData.wallet_address;
    logStep("Creator wallet found", { creatorWalletAddress });

    let normalizedBackendKey = backendPrivateKey.trim();
    if (!normalizedBackendKey.startsWith("0x")) {
      normalizedBackendKey = `0x${normalizedBackendKey}`;
    }

    let normalizedOperatorKey = operatorPrivateKey.trim();
    if (!normalizedOperatorKey.startsWith("0x")) {
      normalizedOperatorKey = `0x${normalizedOperatorKey}`;
    }

    // EOA fallback(직접 트랜잭션)용
    const backendWallet = new ethers.Wallet(normalizedBackendKey, provider);
    // Paymaster(UserOp 서명)용
    const operatorWallet = new ethers.Wallet(normalizedOperatorKey, provider);

    logStep("Backend wallet initialized", {
      backendWallet: backendWallet.address,
      operatorWallet: operatorWallet.address,
    });

    // Backend Smart Account는 운영 주소를 고정 사용 (미배포면 AA13 initCode 오류로 실패)
    const backendSmartAccount = BACKEND_SMART_ACCOUNT;
    logStep("Backend Smart Account", { address: backendSmartAccount });

    const backendAccountCode = await provider.getCode(backendSmartAccount);
    if (backendAccountCode === "0x") {
      throw new Error("Backend Smart Account not deployed. Run deploy-backend-smart-account first.");
    }

    const contract = new ethers.Contract(contractAddress, FANZTOKEN_ABI, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    
    // DB token_id를 그대로 BigInt로 변환
    const tokenIdUint = BigInt(fanzToken.token_id);
    logStep("Token ID converted", { tokenIdUint: tokenIdUint.toString() });

    let buyTxHash: string | null = null;
    let transferTxHash: string | null = null;

    try {
      // 온체인에 토큰이 존재하는지 확인
      logStep("Checking if token exists on-chain");
      let tokenExists = true;
      try {
        await contract.getCurrentPrice(tokenIdUint);
        logStep("Token already exists on-chain");
      } catch (priceError: any) {
        if (priceError.message && priceError.message.includes('Token does not exist')) {
          tokenExists = false;
          logStep("Token does not exist, will create");
        } else {
          throw priceError;
        }
      }

      // 구매 전 온체인 상태 스냅샷 (중복 검증/부분 성공 오판 방지)
      const userBalanceBefore = await contract.balanceOf(userWalletAddress, tokenIdUint);
      let totalSupplyBefore = 0n;
      try {
        const tokenInfoBefore = await contract.tokens(tokenIdUint);
        totalSupplyBefore = tokenInfoBefore[0] as bigint;
      } catch {
        totalSupplyBefore = 0n;
      }
      logStep("Pre-purchase on-chain snapshot", {
        userBalanceBefore: userBalanceBefore.toString(),
        totalSupplyBefore: totalSupplyBefore.toString(),
      });

      // 온체인에서 실제 필요한 비용/수수료를 계산 (USDC 단위, 6 decimals)
      let contractTotalCost: bigint;
      let contractCreatorFee: bigint;
      let contractPlatformFee: bigint;

      if (tokenExists) {
        // V4: calculateBuyCost returns (reserve, artistFund, platform, total)
        const [reserve, artistFund, platform, total] = await contract.calculateBuyCost(tokenIdUint, 1);
        contractTotalCost = total as bigint;
        contractCreatorFee = artistFund as bigint;
        contractPlatformFee = platform as bigint;
      } else {
        // 토큰이 없으면 첫 구매 비용 추정 (basePrice를 reserve로, 총 비용은 basePrice / 0.7)
        const basePriceUsdc = BigInt(1650000); // 1.65 USDC (reserve)
        // V4 비율: Reserve 70%, ArtistFund 20%, Platform 10%
        contractTotalCost = (basePriceUsdc * 100n) / 70n; // ~2.357 USDC
        contractCreatorFee = (basePriceUsdc * 20n) / 70n; // ~0.471 USDC
        contractPlatformFee = (basePriceUsdc * 10n) / 70n; // ~0.236 USDC
      }

      // USDC 단위를 USD로 변환 (6 decimals)
      const totalCostUsd = Number(contractTotalCost) / (10 ** USDC_DECIMALS);
      const creatorFeeUsd = Number(contractCreatorFee) / (10 ** USDC_DECIMALS);
      const platformFeeUsd = Number(contractPlatformFee) / (10 ** USDC_DECIMALS);

      logStep("Contract cost calculated (USDC)", {
        totalCostUsd,
        creatorFeeUsd,
        platformFeeUsd,
        paidUsd,
        contractTotalCostRaw: contractTotalCost.toString()
      });

      // Smart Account의 USDC 잔액 확인
      const smartAccountUsdcBalance = await usdcContract.balanceOf(backendSmartAccount);
      logStep("Smart Account USDC balance", { 
        balance: (Number(smartAccountUsdcBalance) / (10 ** USDC_DECIMALS)).toFixed(2)
      });

      if (smartAccountUsdcBalance < contractTotalCost) {
        throw new Error(`Insufficient USDC in Smart Account. Need: ${totalCostUsd}, Have: ${Number(smartAccountUsdcBalance) / (10 ** USDC_DECIMALS)}`);
      }

      // Slippage protection
      const maxCost = (contractTotalCost * 110n) / 100n;

      // Paymaster 사용 가능 여부 확인
      if (paymasterUrl) {
        logStep("Using Paymaster for gasless transaction with executeBatch optimization");

        const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
        const usdcInterface = new ethers.Interface(USDC_ABI);
        const fanzInterface = new ethers.Interface(FANZTOKEN_ABI);

        // 배치 작업 준비
        const batchDests: string[] = [];
        const batchValues: bigint[] = [];
        const batchData: string[] = [];

        // 1) USDC approve (필요 시에만 - 무한 approve로 이후 호출 생략)
        const currentAllowance = await usdcContract.allowance(backendSmartAccount, contractAddress);
        if (currentAllowance < contractTotalCost) {
          // 무한 approve로 설정하여 이후 구매 시 approve 생략
          const maxApprove = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
          const approveData = usdcInterface.encodeFunctionData("approve", [contractAddress, maxApprove]);
          batchDests.push(USDC_ADDRESS);
          batchValues.push(0n);
          batchData.push(approveData);
          logStep("Adding USDC infinite approve to batch");
        } else {
          logStep("USDC allowance sufficient - skipping approve", {
            allowanceRaw: currentAllowance.toString(),
          });
        }

        // 2) CreateToken if needed
        if (!tokenExists) {
          const basePriceUsdc = BigInt(1650000); // 1.65 USDC (6 decimals)
          const kValueUsdc = BigInt(300000); // 0.3 USDC (6 decimals)
          const createData = fanzInterface.encodeFunctionData("createToken", [
            tokenIdUint,
            creatorWalletAddress,
            basePriceUsdc,
            kValueUsdc,
          ]);
          batchDests.push(contractAddress);
          batchValues.push(0n);
          batchData.push(createData);
          logStep("Adding createToken to batch");
        }

        // 3) Buy token (buyFor)
        const buyData = fanzInterface.encodeFunctionData("buyFor", [tokenIdUint, userWalletAddress, 1, maxCost]);
        batchDests.push(contractAddress);
        batchValues.push(0n);
        batchData.push(buyData);
        logStep("Adding buyFor to batch");

        // executeBatch 또는 execute 선택
        let executeCallData: string;
        if (batchDests.length > 1) {
          // 여러 작업을 executeBatch로 묶음
          // - executeBatch는 (dest[], func[]) 2개 인자 (Backend Smart Account 표준)
          executeCallData = accountInterface.encodeFunctionData("executeBatch", [batchDests, batchData]);
          logStep("Using executeBatch for multiple operations", { operationCount: batchDests.length });
        } else {
          // 단일 작업은 execute 사용
          // - uint256 value는 bigint(0n)로 전달
          executeCallData = accountInterface.encodeFunctionData("execute", [batchDests[0], 0n, batchData[0]]);
          logStep("Using execute for single operation");
        }

        const userOp = await buildUserOperation(provider, backendSmartAccount, executeCallData, operatorWallet);
        logStep("Sending optimized UserOperation with Paymaster");
        buyTxHash = await sendUserOperationWithPaymaster(userOp, paymasterUrl, operatorWallet);

        // buyFor가 actualBuyer에게 직접 민팅하므로 Transfer 단계 제거
        transferTxHash = buyTxHash; // 호환성을 위해 동일한 해시 사용

        logStep("Paymaster transaction completed (executeBatch optimization)", { buyTxHash, operationCount: batchDests.length });

      } else {
        // Fallback: Direct EOA transaction (기존 방식)
        logStep("Paymaster not configured, using direct EOA transactions");
        
        const backendWalletWithProvider = backendWallet.connect(provider);
        const contractWithSigner = new ethers.Contract(contractAddress, FANZTOKEN_ABI, backendWalletWithProvider);
        const usdcWithSigner = new ethers.Contract(USDC_ADDRESS, USDC_ABI, backendWalletWithProvider);

        // Check EOA USDC balance
        const eoaUsdcBalance = await usdcContract.balanceOf(backendWallet.address);
        if (eoaUsdcBalance < contractTotalCost) {
          throw new Error(`Insufficient USDC in EOA. Need: ${totalCostUsd}, Have: ${Number(eoaUsdcBalance) / (10 ** USDC_DECIMALS)}`);
        }

        // CreateToken if needed
        if (!tokenExists) {
          const basePriceUsdc = BigInt(1650000); // 1.65 USDC (6 decimals)
          // kValue: curve coefficient (USDC 6 decimals). 예) 0.3 → 300,000
          const kValueUsdc = BigInt(300000);
          const createTokenTx = await contractWithSigner.createToken(tokenIdUint, creatorWalletAddress, basePriceUsdc, kValueUsdc);
          await createTokenTx.wait();
          logStep("Token created");
        }

        // Approve USDC
        const currentAllowance = await usdcContract.allowance(backendWallet.address, contractAddress);
        if (currentAllowance < contractTotalCost) {
          const approveTx = await usdcWithSigner.approve(contractAddress, maxCost);
          await approveTx.wait();
          logStep("USDC approved");
        }

        // Buy (buyFor로 DAU 추적 - V4: buyFor는 actualBuyer에게 직접 민팅하므로 별도 Transfer 불필요)
        const buyTx = await contractWithSigner.buyFor(tokenIdUint, userWalletAddress, 1, maxCost);
        buyTxHash = buyTx.hash;
        await buyTx.wait();
        logStep("Buy completed (buyFor mints directly to user)", { txHash: buyTxHash, actualBuyer: userWalletAddress });

        // buyFor가 actualBuyer에게 직접 민팅하므로 Transfer 단계 제거
        transferTxHash = buyTxHash; // 호환성을 위해 동일한 해시 사용
      }

      // Verify on-chain state changed as expected (사용자가 기존에 보유한 경우도 안전하게 검증)
      const userBalanceAfter = await contract.balanceOf(userWalletAddress, tokenIdUint);
      const tokenInfoAfter = await contract.tokens(tokenIdUint);
      const totalSupplyAfter = tokenInfoAfter[0] as bigint;

      logStep("Post-purchase on-chain snapshot", {
        userBalanceBefore: userBalanceBefore.toString(),
        userBalanceAfter: userBalanceAfter.toString(),
        totalSupplyBefore: totalSupplyBefore.toString(),
        totalSupplyAfter: totalSupplyAfter.toString(),
      });

      if (userBalanceAfter !== userBalanceBefore + 1n) {
        throw new Error(
          `Transfer verification failed: expected user balance ${userBalanceBefore + 1n}, got ${userBalanceAfter}`
        );
      }

      if (totalSupplyAfter !== totalSupplyBefore + 1n) {
        throw new Error(
          `Mint verification failed: expected totalSupply ${totalSupplyBefore + 1n}, got ${totalSupplyAfter}`
        );
      }

      // 데이터베이스 업데이트
      logStep("Updating database with USDC amounts", {
        paidUsd,
        totalCostUsd,
        creatorFeeUsd,
        platformFeeUsd,
      });

      const { data: transactionData, error: txError } = await supabaseClient.rpc('execute_fanztoken_purchase', {
        p_token_id: tokenId,
        p_user_id: userId,
        p_amount: 1,
        p_price_per_token: paidUsd,
        p_total_value: paidUsd,
        p_creator_fee: creatorFeeUsd,
        p_platform_fee: platformFeeUsd,
        p_payment_token: 'USDC',
        p_payment_value: paidUsd,
        p_tx_hash: buyTxHash || 'pending'
      });

      if (txError) {
        if (txError.message && txError.message.includes('duplicate')) {
          logStep("Purchase already recorded, treating as success");
        } else {
          logStep("WARNING: Database update failed but token already transferred", { error: txError.message });
          
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: 'admin',
              type: 'admin_alert',
              title: 'DB Update Failed - Manual Action Required',
              message: `Token transferred to user but DB update failed. User: ${userId}, Token: ${tokenId}, TxHash: ${buyTxHash}, Error: ${txError.message.substring(0, 200)}`,
              reference_id: tokenId
            });
        }
      }

      // payment_intent_id를 트랜잭션에 저장 (tx_hash 기반으로 정확히 매칭)
      if (session.payment_intent && buyTxHash) {
        const { error: piUpdateError } = await supabaseClient
          .from('fanz_transactions')
          .update({ stripe_payment_intent_id: session.payment_intent as string })
          .eq('tx_hash', buyTxHash)
          .eq('transaction_type', 'buy');

        if (piUpdateError) {
          logStep("WARNING: Failed to save payment intent ID", {
            paymentIntentId: session.payment_intent,
            txHash: buyTxHash,
            error: piUpdateError.message,
          });
        } else {
          logStep("Payment intent ID saved to transaction", {
            paymentIntentId: session.payment_intent,
            txHash: buyTxHash,
          });
        }
      } else if (session.payment_intent) {
        logStep("WARNING: Missing txHash for payment intent mapping", {
          paymentIntentId: session.payment_intent,
        });
      }

      // 관리자가 설정한 스타 보너스 지급 (point_rules에서 조회)
      try {
        const { data: bonusRule } = await supabaseClient
          .from('point_rules')
          .select('points')
          .eq('action_type', 'fanztoken_purchase_bonus')
          .eq('is_active', true)
          .single();

        const BONUS_STARS = bonusRule?.points || 0;

        if (BONUS_STARS > 0) {
          const { data: currentProfile } = await supabaseClient
            .from('profiles')
            .select('available_points, total_points')
            .eq('id', userId)
            .single();

          if (currentProfile) {
            await supabaseClient
              .from('profiles')
              .update({ 
                available_points: currentProfile.available_points + BONUS_STARS,
                total_points: currentProfile.total_points + BONUS_STARS
              })
              .eq('id', userId);

            await supabaseClient
              .from('point_transactions')
              .insert({
                user_id: userId,
                action_type: 'fanztoken_purchase_bonus',
                points: BONUS_STARS,
                reference_id: tokenId
              });

            logStep("Bonus stars awarded", { userId, bonus: BONUS_STARS });
          }
        } else {
          logStep("No bonus stars configured or rule inactive");
        }
      } catch (bonusErr: any) {
        logStep("WARNING: Failed to award bonus stars", { error: bonusErr.message, userId });
      }

      logStep("Purchase completed successfully", { buyTxHash, transferTxHash });
    } catch (contractError: any) {
      logStep("Contract interaction error", { error: contractError.message });
      
      if (contractError.message && contractError.message.includes('already known')) {
        logStep("Transaction already processed, treating as success");
      } else {
        // buy() 실패 시 Stripe 환불 처리
        logStep("CRITICAL: Contract call failed, initiating Stripe refund", { 
          error: contractError.message,
          sessionId: session.id 
        });
        
        try {
          if (session.payment_intent) {
            const errorMsg = contractError.message.substring(0, 400);
            const refund = await stripe.refunds.create({
              payment_intent: session.payment_intent as string,
              reason: 'requested_by_customer',
              metadata: {
                reason: 'contract_call_failed',
                error: errorMsg
              }
            });
            
            logStep("Stripe refund created successfully", { 
              refundId: refund.id,
              amount: refund.amount,
              status: refund.status 
            });
            
            // 관리자에게 알림
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: 'admin',
                type: 'admin_alert',
                title: 'Contract Buy Failed - Refund Issued',
                message: `Contract buy() failed. Reason: ${errorMsg.substring(0, 100)}. Refund ID: ${refund.id}`,
                reference_id: tokenId
              });
            
            // 사용자에게 실패 알림 전송
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: userId,
                type: 'fanz_purchase_failed',
                title: 'Purchase Failed - Refund Issued',
                message: `Your LightStick purchase could not be completed due to high demand. Your payment has been automatically refunded.`,
                reference_id: tokenId
              });
            
            logStep("User notification sent for failed purchase", { userId, tokenId });
            
            return new Response(
              JSON.stringify({ 
                received: true, 
                refunded: true,
                reason: 'Contract call failed, payment refunded'
              }),
              { status: 200 }
            );
          }
        } catch (refundError: any) {
          logStep("CRITICAL: Buy failed AND refund failed - URGENT MANUAL ACTION REQUIRED", {
            sessionId: session.id,
            userId,
            tokenId,
            paymentIntent: session.payment_intent,
            contractError: contractError.message,
            refundError: refundError.message
          });
          
          // 관리자에게 긴급 알림
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: 'admin',
              type: 'admin_alert',
              title: 'URGENT: Buy + Refund Failed',
              message: `User paid but contract failed. Manual refund required! Session: ${session.id}, User: ${userId}, Token: ${tokenId}`,
              reference_id: tokenId
            });
          
          // 사용자에게 알림 전송
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'fanz_purchase_failed',
              title: 'Purchase Processing Issue',
              message: `We encountered an issue processing your LightStick purchase. Our team has been notified and will resolve this shortly.`,
              reference_id: tokenId
            });
        }
        
        throw new Error(`Contract call failed: ${contractError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
});
