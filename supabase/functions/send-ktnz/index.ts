import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ethers } from "https://esm.sh/ethers@6.7.0";

// AES 복호화 헬퍼 함수
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Base64 디코딩
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Salt, IV, Encrypted data 분리
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  
  // 암호화 키를 CryptoKey로 변환
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // 키 파생 (암호화할 때와 동일한 파라미터 사용)
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
    encrypted
  );
  
  return decoder.decode(decrypted);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { toAddress, amount } = await req.json();

    if (!toAddress || !amount) {
      throw new Error("Missing required parameters: toAddress and amount");
    }

    // 최소 출금 수량 체크 (100 KTNZ)
    const MINIMUM_WITHDRAWAL_KTNZ = 100;
    const amountNumber = parseFloat(amount);
    
    if (amountNumber < MINIMUM_WITHDRAWAL_KTNZ) {
      throw new Error(`Minimum withdrawal amount is ${MINIMUM_WITHDRAWAL_KTNZ} KTNZ`);
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      throw new Error("Invalid Ethereum address format");
    }

    // Get user's smart wallet address (QuestN external wallet 제외)
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("wallet_type", "smart_wallet")
      .maybeSingle();

    if (walletError || !walletData) {
      throw new Error("Wallet not found");
    }

    // Get user's private key (service role needed)
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("wallet_private_keys")
      .select("encrypted_private_key")
      .eq("user_id", user.id)
      .eq("wallet_address", walletData.wallet_address)
      .single();

    if (keyError || !keyData) {
      console.error("Private key not found:", keyError);
      throw new Error("Wallet private key not found");
    }

    const contractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");

    if (!contractAddress || !rpcUrl || !encryptionKey) {
      console.error("Missing configuration");
      throw new Error("Server configuration error");
    }

    console.log("Processing KTNZ transfer:", {
      from: walletData.wallet_address,
      to: toAddress,
      amount: amount,
    });

    // 프라이빗 키 복호화 (신규 AES 형식 + 레거시 평문 형식 모두 지원)
    let decryptedPrivateKey: string;
    const storedKey = keyData.encrypted_private_key;

    // 레거시 형식: 0x + 64자리 hex 인 경우 그대로 사용
    if (/^0x[a-fA-F0-9]{64}$/.test(storedKey)) {
      console.log("Using legacy plaintext private key format");
      decryptedPrivateKey = storedKey;
    } else {
      try {
        decryptedPrivateKey = await decryptPrivateKey(storedKey, encryptionKey);
        console.log("Private key decrypted successfully");
      } catch (decryptError) {
        console.error("Private key decryption failed, falling back to stored value:", decryptError);
        decryptedPrivateKey = storedKey;
      }
    }

    // Create provider and wallet using decrypted/legacy private key
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(decryptedPrivateKey, provider);

    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== walletData.wallet_address.toLowerCase()) {
      console.error("Wallet mismatch:", { 
        expected: walletData.wallet_address, 
        actual: wallet.address 
      });
      throw new Error("Wallet address mismatch");
    }

    // Create contract interface
    const abi = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    // Check balance before transfer
    const balance = await contract.balanceOf(walletData.wallet_address);
    const amountWei = ethers.parseEther(amount.toString());

    if (balance < amountWei) {
      throw new Error("Insufficient KTNZ balance");
    }

    // Execute transfer
    console.log("Executing transfer...");
    const tx = await contract.transfer(toAddress, amountWei);
    
    console.log("Transaction sent:", tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log("Transaction confirmed:", {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        from: walletData.wallet_address,
        to: toAddress,
        amount: amount
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending KTNZ:", error);
    
    // Sanitize error message to avoid leaking sensitive info
    let errorMessage = "Failed to send KTNZ";
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        errorMessage = "Insufficient ETH for gas fees";
      } else if (error.message.includes("Insufficient KTNZ balance")) {
        errorMessage = error.message;
      } else if (error.message.includes("Invalid")) {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
