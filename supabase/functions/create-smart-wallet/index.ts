import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// AES 암호화 헬퍼 함수들
async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  
  // 암호화 키를 CryptoKey로 변환
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // Salt 생성 (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 키 파생
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
    ["encrypt"]
  );
  
  // IV 생성 (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 암호화
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  
  // Salt + IV + Encrypted data를 base64로 인코딩
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;
    
    if (!user) throw new Error("User not authenticated");

    let forceRegenerate = false;
    try {
      const body = await req.json();
      forceRegenerate = Boolean((body as any).forceRegenerate);
    } catch (_jsonError) {
      // Body might be empty, ignore
    }

    console.log("Creating smart wallet for user:", user.id, "forceRegenerate:", forceRegenerate);

    // Check if smart wallet already exists
    const { data: existingWallet, error: walletCheckError } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("wallet_type", "smart_wallet")
      .maybeSingle();

    // Ignore "not found" errors
    if (walletCheckError && walletCheckError.code !== 'PGRST116') {
      console.error("Error checking existing wallet:", walletCheckError);
      throw walletCheckError;
    }

    if (existingWallet && !forceRegenerate) {
      console.log("Existing wallet found, returning without changes");
      return new Response(JSON.stringify({ 
        wallet_address: existingWallet.wallet_address,
        network: "base",
        message: "Wallet already exists"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (existingWallet && forceRegenerate) {
      console.log("Force regenerating wallet for user:", user.id);

      const { error: deleteKeysError } = await supabaseAdmin
        .from("wallet_private_keys")
        .delete()
        .eq("user_id", user.id);

      if (deleteKeysError) {
        console.error("Error deleting existing private keys:", deleteKeysError);
      }

      const { error: deleteWalletError } = await supabaseAdmin
        .from("wallet_addresses")
        .delete()
        .eq("user_id", user.id)
        .eq("wallet_type", "smart_wallet");

      if (deleteWalletError) {
        console.error("Error deleting existing wallet address:", deleteWalletError);
      }
    }

    // Generate new EOA wallet (for signing)
    const { ethers } = await import("https://esm.sh/ethers@6.7.0");
    const eoaWallet = ethers.Wallet.createRandom();
    
    console.log("EOA wallet generated:", eoaWallet.address);

    // Coinbase Smart Wallet Factory 주소 및 설정
    const COINBASE_SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

    // Factory staticcall로 Smart Wallet 주소 예측 (배포 없이 주소만 계산)
    // Alchemy 유료 플랜 우선 사용
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    if (!alchemyKey) {
      console.warn("ALCHEMY_API_KEY not set, using public RPC as fallback");
    }
    const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    const PUBLIC_RPC = "https://mainnet.base.org";

    const owners = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [eoaWallet.address])];
    const nonce = 0n;

    const factoryInterface = new ethers.Interface([
      "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
    ]);

    const callData = factoryInterface.encodeFunctionData("getAddress", [owners, nonce]);

    // Alchemy 우선 사용, 실패 시 Public RPC fallback
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500;
    let lastError: Error | null = null;
    let callResult: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Alchemy 먼저, 마지막 시도에서만 public fallback
      const rpcUrl = (attempt < MAX_RETRIES - 1 && alchemyKey) ? ALCHEMY_RPC : PUBLIC_RPC;
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        callResult = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data: callData });
        break; // Success
      } catch (err: any) {
        lastError = err;
        console.warn(`RPC call failed (attempt ${attempt + 1}/${MAX_RETRIES}, rpc: ${rpcUrl}):`, err.message);
        
        // Rate limit error - wait and retry
        if (err.message?.includes('429') || err.info?.error?.code === 429) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        } else if (attempt === MAX_RETRIES - 1) {
          throw err;
        }
      }
    }

    if (!callResult) {
      throw lastError || new Error('Failed to call factory contract');
    }

    const decoded = factoryInterface.decodeFunctionResult("getAddress", callResult) as unknown as [string];
    const smartWalletAddress = ethers.getAddress(decoded[0]);

    console.log("Coinbase Smart Wallet address predicted:", smartWalletAddress);

    // 암호화 키 가져오기
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("Encryption key not configured");
    }

    // 프라이빗 키 암호화 (EOA 키 저장 - 서명용)
    const encryptedPrivateKey = await encryptPrivateKey(eoaWallet.privateKey, encryptionKey);
    console.log("Private key encrypted successfully");

    // Store wallet private key (Smart Wallet 주소와 EOA 키 저장)
    const { error: keyInsertError } = await supabaseAdmin
      .from("wallet_private_keys")
      .insert({
        user_id: user.id,
        wallet_address: smartWalletAddress,
        encrypted_private_key: encryptedPrivateKey,
      });

    if (keyInsertError && keyInsertError.code !== '23505') {
      console.error("Error storing private key:", keyInsertError);
      throw new Error("Failed to store wallet private key");
    }

    // Store Smart Wallet address (사용자에게 보여주는 주소)
    const { error: insertError } = await supabaseAdmin
      .from("wallet_addresses")
      .insert({
        user_id: user.id,
        wallet_address: smartWalletAddress,
        network: "base",
        wallet_type: "smart_wallet",
      });

    if (insertError) {
      // 23505 = unique constraint violation (레이스 컨디션: 동시 호출)
      if (insertError.code === '23505') {
        console.log("Duplicate insert detected (race condition), fetching existing wallet");
        const { data: raceWallet } = await supabaseAdmin
          .from("wallet_addresses")
          .select("wallet_address")
          .eq("user_id", user.id)
          .eq("wallet_type", "smart_wallet")
          .maybeSingle();

        if (raceWallet) {
          return new Response(JSON.stringify({
            wallet_address: raceWallet.wallet_address,
            network: "base",
            message: "Wallet already exists (race condition resolved)"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      console.error("Error inserting wallet:", insertError);
      throw insertError;
    }

    console.log("Coinbase Smart Wallet created successfully:", smartWalletAddress);
    console.log("EOA signer address:", eoaWallet.address);

    return new Response(JSON.stringify({ 
      wallet_address: smartWalletAddress,
      eoa_address: eoaWallet.address,
      network: "base",
      message: "Coinbase Smart Wallet created successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating smart wallet:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
