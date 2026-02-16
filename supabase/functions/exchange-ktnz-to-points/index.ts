import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ethers } from "https://esm.sh/ethers@6.7.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DAU 기록용 활동 타입
const ACTIVITY_KTNZ_BURN = ethers.keccak256(ethers.toUtf8Bytes("ktnz_burn"));

// DAU 기록 헬퍼 함수
async function recordDAUActivity(
  userWalletAddress: string,
  referenceHash: string
): Promise<void> {
  const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS");
  const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
  const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
  const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
  
  if (!dauContractAddress || !paymasterUrl || !operatorPrivateKey) {
    console.log("DAU recording skipped - missing config");
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
    const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    // DAU calldata
    const dauInterface = new ethers.Interface([
      "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
    ]);
    const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
      userWalletAddress,
      ACTIVITY_KTNZ_BURN,
      referenceHash,
    ]);

    const accountInterface = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external",
    ]);
    const executeCalldata = accountInterface.encodeFunctionData("execute", [
      dauContractAddress,
      0n,
      dauCalldata,
    ]);

    // nonce 조회
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ]);
    const nonceData = await provider.call({
      to: ENTRY_POINT_ADDRESS,
      data: entryPointInterface.encodeFunctionData("getNonce", [BACKEND_SMART_ACCOUNT, 0n]),
    });
    const nonce = BigInt(nonceData);

    const feeData = await provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas ?? ethers.parseUnits("0.5", "gwei")) as bigint;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.1", "gwei")) as bigint;

    const userOp = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      callGasLimit: "0x15f90",
      verificationGasLimit: "0x15f90",
      preVerificationGas: "0x5208",
      maxFeePerGas: "0x" + maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Paymaster 요청
    const pmResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1, jsonrpc: "2.0", method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT_ADDRESS, "0x2105", {}],
      }),
    });
    const pmResult = await pmResponse.json();
    if (pmResult.error) throw new Error(pmResult.error.message);
    userOp.paymasterAndData = pmResult.result?.paymasterAndData || "0x";

    // UserOp 서명
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [userOp.sender, BigInt(userOp.nonce), ethers.keccak256(userOp.initCode), ethers.keccak256(userOp.callData),
       BigInt(userOp.callGasLimit), BigInt(userOp.verificationGasLimit), BigInt(userOp.preVerificationGas),
       BigInt(userOp.maxFeePerGas), BigInt(userOp.maxPriorityFeePerGas), ethers.keccak256(userOp.paymasterAndData)]
    );
    const userOpHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT_ADDRESS, 8453n])
    );
    userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

    // Bundler 제출 (결과 대기 없이 백그라운드 처리)
    fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "eth_sendUserOperation", params: [userOp, ENTRY_POINT_ADDRESS] }),
    }).catch(e => console.error("DAU bundler error:", e));

    console.log("DAU activity recorded for ktnz_burn");
  } catch (e) {
    console.error("DAU recording error:", e);
  }
}

// 암호화된 private key 복호화 함수 (AES-GCM + PBKDF2 방식)
async function decryptPrivateKey(encryptedKey: string, encryptionKey: string): Promise<string> {
  console.log('Attempting to decrypt private key...');
  
  if (!encryptedKey || typeof encryptedKey !== 'string') {
    throw new Error('Invalid encrypted key format');
  }
  
  // 평문 private key인지 확인 (0x로 시작하고 길이가 66인 경우)
  if (encryptedKey.startsWith('0x') && encryptedKey.length === 66) {
    console.log('Private key is in plain text format (legacy), using as-is');
    return encryptedKey;
  }
  
  try {
    // Base64 디코딩
    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    
    // Salt (16 bytes) + IV (12 bytes) + Encrypted data 분리
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);
    
    const encoder = new TextEncoder();
    
    // 암호화 키를 CryptoKey로 변환
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(encryptionKey),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    
    // 키 파생 (암호화할 때와 동일한 방식)
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
      ["decrypt"]
    );
    
    // 복호화
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed - wallet may need to be regenerated');
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { tokensToExchange } = await req.json();
    
    if (!tokensToExchange || tokensToExchange <= 0) {
      throw new Error("Invalid token amount");
    }

    // Get user's smart wallet (QuestN external wallet 제외)
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("wallet_type", "smart_wallet")
      .maybeSingle();

    if (walletError || !walletData) {
      throw new Error("Wallet not found");
    }

    // Get user's encrypted private key
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("wallet_private_keys")
      .select("encrypted_private_key")
      .eq("user_id", user.id)
      .eq("wallet_address", walletData.wallet_address)
      .single();

    if (keyError || !keyData) {
      throw new Error("Private key not found");
    }

    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("WALLET_ENCRYPTION_KEY not configured");
    }

    const contractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    const tokenToPointsRate = Deno.env.get("TOKEN_TO_POINTS_RATE") || "10"; // Default: 1 KTNZ = 10 points

    if (!contractAddress || !rpcUrl) {
      throw new Error("Contract configuration missing");
    }

    // Decrypt private key
    const privateKey = await decryptPrivateKey(keyData.encrypted_private_key, encryptionKey);

    // Calculate points to award
    const pointsToAward = Math.floor(tokensToExchange * parseInt(tokenToPointsRate));
    const tokenAmountWei = ethers.parseEther(tokensToExchange.toString());

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const userWallet = new ethers.Wallet(privateKey, provider);

    // Check ETH balance for gas
    const ethBalance = await provider.getBalance(walletData.wallet_address);
    console.log(`ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
    
    // Minimum ETH needed for gas (roughly estimated)
    const minEthForGas = ethers.parseEther("0.00005"); // 0.00005 ETH minimum
    
    if (ethBalance < minEthForGas) {
      throw new Error(`Insufficient ETH for gas fees. Need at least 0.00005 ETH, have ${ethers.formatEther(ethBalance)} ETH. Please add ETH to your wallet: ${walletData.wallet_address}`);
    }

    // Contract ABI
    const abi = [
      "function burn(uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, userWallet);

    // Check user's token balance
    const balance = await contract.balanceOf(walletData.wallet_address);
    
    if (balance < tokenAmountWei) {
      throw new Error(`Insufficient KTNZ balance. Have ${ethers.formatEther(balance)} KTNZ, need ${tokensToExchange} KTNZ`);
    }

    // Burn tokens
    console.log(`Burning ${tokensToExchange} KTNZ from ${walletData.wallet_address}`);
    const tx = await contract.burn(tokenAmountWei);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    // Award points to user
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("available_points")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        available_points: profile.available_points + pointsToAward 
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to award points:", updateError);
      throw new Error("Token burned but failed to award points - contact support");
    }

    // Record transaction
    await supabaseAdmin.from("point_transactions").insert({
      user_id: user.id,
      action_type: "exchange_ktnz_to_points",
      points: pointsToAward,
      reference_id: receipt.hash
    });

    // Create notification
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      type: "points_earned",
      title: "KTNZ Exchanged Successfully",
      message: `You exchanged ${tokensToExchange} KTNZ and received ${pointsToAward} points`,
      reference_id: receipt.hash
    });

    // DAU 기록 (백그라운드 처리)
    const referenceHash = ethers.keccak256(ethers.solidityPacked(['string'], [receipt.hash]));
    recordDAUActivity(walletData.wallet_address, referenceHash).catch(e => 
      console.error('DAU recording failed (non-fatal):', e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        transactionHash: receipt.hash,
        tokensBurned: tokensToExchange,
        pointsAwarded: pointsToAward,
        message: `Successfully exchanged ${tokensToExchange} KTNZ for ${pointsToAward} points`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Exchange error:", error);
    
    let errorMessage = "Failed to exchange tokens";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide user-friendly messages for common errors
      if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient ETH for gas fees. Please add ETH to your wallet on Base network.";
      } else if (errorMessage.includes("Insufficient KTNZ balance")) {
        // Keep the detailed KTNZ balance message as-is
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
