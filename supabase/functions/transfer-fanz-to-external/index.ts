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

// Paymaster/Bundler
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// FanzToken V5 ABI (transferFor)
const FANZTOKEN_ABI = [
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
    return ethers.getAddress(input.trim().toLowerCase());
  } catch {
    throw new Error(`Invalid address for ${label}: ${input}`);
  }
}

function logStep(step: string, data?: unknown) {
  console.log(`[TRANSFER-FANZ-TO-EXTERNAL] ${step}`, data ? JSON.stringify(data) : "");
}

// AES-GCM 복호화 헬퍼
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const keyBuffer = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
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

    // 인증 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    logStep("User authenticated", { userId: user.id });

    // 1. 유저의 지갑 정보 조회 (smart_wallet > eoa 순서)
    // - wallet_addresses 테이블에는 encrypted_private_key 컬럼이 없으므로 select에 포함하면 조회가 실패함
    // - 여기서는 "주소"만 필요
    let walletData: { wallet_address: string; wallet_type: string } | null = null;

    const { data: smartWallet, error: smartWalletError } = await supabaseClient
      .from('wallet_addresses')
      .select('wallet_address, wallet_type')
      .eq('user_id', user.id)
      .eq('wallet_type', 'smart_wallet')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smartWalletError) {
      logStep('Smart wallet query error', { message: smartWalletError.message });
    }

    if (smartWallet) {
      walletData = smartWallet;
    } else {
      const { data: eoaWallet, error: eoaWalletError } = await supabaseClient
        .from('wallet_addresses')
        .select('wallet_address, wallet_type')
        .eq('user_id', user.id)
        .eq('wallet_type', 'eoa')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eoaWalletError) {
        logStep('EOA wallet query error', { message: eoaWalletError.message });
      }

      if (eoaWallet) {
        walletData = eoaWallet;
      }
    }

    if (!walletData) {
      throw new Error("No source wallet found. Please create a wallet first in Wallet page.");
    }

    logStep("Source wallet found", { type: walletData.wallet_type, address: walletData.wallet_address });

    // 2. 유저의 External Wallet 주소 조회
    const { data: externalWalletData, error: ewError } = await supabaseClient
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('wallet_type', 'external')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ewError || !externalWalletData) {
      throw new Error("External wallet not connected. Please connect your Base Wallet first.");
    }

    const externalWalletAddress = normalizeAddress(externalWalletData.wallet_address, "externalWallet");
    logStep("External wallet found", { address: externalWalletAddress });

    // 3. Provider 설정
    if (!BASE_MAINNET_RPC) {
      throw new Error("BASE_RPC_URL not configured");
    }
    const provider = new ethers.JsonRpcProvider(BASE_MAINNET_RPC);
    const chainId = 8453n;

    // 4. Source Wallet 주소 (DB에 저장된 주소 사용)
    const sourceWalletAddress = normalizeAddress(walletData.wallet_address, "sourceWallet");
    logStep("Source Wallet address", { address: sourceWalletAddress });

    // 5. 컨트랙트 설정
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
    if (!paymasterUrl) {
      throw new Error("COINBASE_PAYMASTER_URL not configured");
    }

    const fanzTokenAddressRaw = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    if (!fanzTokenAddressRaw) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS not configured");
    }

    const fanzTokenAddress = normalizeAddress(fanzTokenAddressRaw, "FANZTOKEN_CONTRACT_ADDRESS");
    const backendOperatorAddr = normalizeAddress(BACKEND_OPERATOR_ADDRESS, "BACKEND_OPERATOR_ADDRESS");

    const fanzTokenContract = new ethers.Contract(fanzTokenAddress, FANZTOKEN_ABI, provider);

    // 6. Operator 권한 확인
    const isOperator = await fanzTokenContract.isOperator(backendOperatorAddr);
    if (!isOperator) {
      throw new Error("Backend account is not an operator on the contract");
    }

    // 7. DB에서 유저의 fanz_balances 조회 (V5 컨트랙트만)
    const V5_CONTRACT_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7";

    const { data: balanceRows, error: balError } = await supabaseClient
      .from('fanz_balances')
      .select('fanz_token_id, balance')
      .eq('user_id', user.id)
      .gt('balance', 0);

    if (balError) {
      logStep("Balance query error", { message: balError.message, code: balError.code, details: balError.details });
      throw new Error(`Failed to fetch token balances: ${balError.message}`);
    }

    if (!balanceRows || balanceRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tokens to transfer",
          transferredTokens: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // fanz_tokens 메타데이터 조회 (join select 에러를 피하기 위해 분리 조회)
    const tokenRowIds = balanceRows.map((r) => r.fanz_token_id);

    const { data: tokenRows, error: tokenError } = await supabaseClient
      .from('fanz_tokens')
      .select('id, token_id, contract_address, wiki_entries(title)')
      .in('id', tokenRowIds)
      .eq('contract_address', V5_CONTRACT_ADDRESS);

    if (tokenError) {
      logStep("Token meta query error", { message: tokenError.message, code: tokenError.code, details: tokenError.details });
      throw new Error(`Failed to fetch token metadata: ${tokenError.message}`);
    }

    const tokenById = new Map<string, any>();
    (tokenRows ?? []).forEach((t: any) => tokenById.set(t.id, t));

    const balances = balanceRows
      .filter((r) => tokenById.has(r.fanz_token_id))
      .map((r) => ({
        ...r,
        fanz_tokens: tokenById.get(r.fanz_token_id),
      }));

    if (balances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tokens to transfer",
          transferredTokens: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Tokens to transfer", { count: balances.length });

    // 8. Backend Operator 키 로드
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    if (!operatorPrivateKey) {
      throw new Error("BASE_OPERATOR_PRIVATE_KEY not configured");
    }

    let normalizedKey = operatorPrivateKey.trim();
    if (!normalizedKey.startsWith("0x")) {
      normalizedKey = `0x${normalizedKey}`;
    }
    const operatorEoa = new ethers.Wallet(normalizedKey, provider);

    // 9. 각 토큰별로 이전 처리
    const transferResults: { tokenId: string; amount: string; txHash: string; name: string }[] = [];
    const simpleAccountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const simpleAccountContract = new ethers.Contract(backendOperatorAddr, SIMPLE_ACCOUNT_ABI, provider);

    for (const bal of balances as any[]) {
      const fanzToken = bal.fanz_tokens;
      const tokenIdStr = fanzToken?.token_id;
      const wikiEntry = fanzToken?.wiki_entries;
      const tokenName = (wikiEntry && typeof wikiEntry === 'object')
        ? (wikiEntry.title || `Token ${tokenIdStr}`)
        : `Token ${tokenIdStr}`;
      const amount = BigInt(bal.balance);
      const balanceId = bal.fanz_token_id; // fanz_balances의 primary key 대신 fanz_token_id 사용

      if (!tokenIdStr || amount <= 0n) continue;

      const tokenIdNum = BigInt(tokenIdStr);

      // 온체인 잔액 확인
      const onchainBalance = await fanzTokenContract.balanceOf(sourceWalletAddress, tokenIdNum);
      if (onchainBalance < amount) {
        logStep("Insufficient on-chain balance", { tokenId: tokenIdStr, onchain: onchainBalance.toString(), db: amount.toString() });
        continue;
      }

      logStep("Transferring token", { tokenId: tokenIdStr, amount: amount.toString(), from: sourceWalletAddress, to: externalWalletAddress });

      // transferFor calldata 생성
      const transferForData = fanzTokenContract.interface.encodeFunctionData("transferFor", [
        tokenIdNum,
        sourceWalletAddress,
        externalWalletAddress,
        amount,
      ]);

      // SimpleAccount execute calldata
      const executeCallData = simpleAccountInterface.encodeFunctionData("execute", [
        fanzTokenAddress,
        0n,
        transferForData,
      ]);

      // Nonce 조회
      const nonce = await simpleAccountContract.getNonce();

      // Gas 정보
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice ?? 1000000n;
      const maxPriorityFeePerGas = 1500000n;
      const maxFeePerGas = (baseFee * 12n) / 10n + maxPriorityFeePerGas;

      // UserOperation 구성
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

      // Paymaster 데이터 요청
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
      if (paymasterResult.error) {
        logStep("Paymaster error", paymasterResult.error);
        continue;
      }

      userOp.paymasterAndData = paymasterResult.result.paymasterAndData;
      if (paymasterResult.result.callGasLimit) userOp.callGasLimit = paymasterResult.result.callGasLimit;
      if (paymasterResult.result.verificationGasLimit) userOp.verificationGasLimit = paymasterResult.result.verificationGasLimit;
      if (paymasterResult.result.preVerificationGas) userOp.preVerificationGas = paymasterResult.result.preVerificationGas;

      // UserOp 서명
      const userOpHash = getUserOpHash(userOp, ENTRY_POINT, chainId);
      const signature = await operatorEoa.signMessage(ethers.getBytes(userOpHash));
      userOp.signature = signature;

      // Bundler로 전송
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
      if (bundlerResult.error) {
        logStep("Bundler error", bundlerResult.error);
        continue;
      }

      const userOpHashReturned = bundlerResult.result;

      // Receipt 대기 (최대 60초)
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
        logStep("Receipt timeout for token", { tokenId: tokenIdStr });
        continue;
      }

      const txHash = (receipt.receipt?.transactionHash as string | undefined) ?? "";
      const userOpSucceeded = receipt.success === true || receipt.success === "0x1" || receipt.success === 1;

      if (userOpSucceeded && txHash) {
        logStep("Transfer successful", { tokenId: tokenIdStr, txHash });
        
        transferResults.push({
          tokenId: tokenIdStr,
          amount: amount.toString(),
          txHash,
          name: tokenName,
        });

        // DB 업데이트: fanz_balances를 0으로 설정 (이미 외부 지갑으로 이전됨)
        await supabaseClient
          .from('fanz_balances')
          .update({ balance: 0 })
          .eq('user_id', user.id)
          .eq('fanz_token_id', balanceId);
      }
    }

    logStep("Transfer complete", { transferred: transferResults.length });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Transferred ${transferResults.length} token(s) to your external wallet`,
        transferredTokens: transferResults,
        externalWallet: externalWalletAddress,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
