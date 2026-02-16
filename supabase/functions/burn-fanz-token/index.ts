import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.9.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FanzTokenUSDC V4 컨트랙트 주소 (시크릿 사용)
const FANZTOKEN_CONTRACT_ADDRESS = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
if (!FANZTOKEN_CONTRACT_ADDRESS) {
  throw new Error("FANZTOKEN_CONTRACT_ADDRESS secret is required");
}

// 간소화된 ABI (burn 함수 포함)
const FANZTOKEN_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function burn(address account, uint256 id, uint256 value)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
];

// 플랫폼 지갑 주소 (소각 대신 플랫폼으로 전송)
const PLATFORM_WALLET = "0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 사용자 인증
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { wikiEntryId, amount, reason } = await req.json();

    if (!wikiEntryId || !amount || amount < 1) {
      throw new Error('Invalid parameters');
    }

    console.log(`[burn-fanz-token] Starting burn: user=${user.id}, entry=${wikiEntryId}, amount=${amount}, reason=${reason}`);

    // 1. 해당 엔트리의 Fanz Token 조회
    const { data: fanzToken, error: tokenError } = await supabase
      .from('fanz_tokens')
      .select('*')
      .eq('wiki_entry_id', wikiEntryId)
      .eq('is_active', true)
      .single();

    if (tokenError || !fanzToken) {
      console.error('[burn-fanz-token] Token not found:', tokenError);
      throw new Error('TOKEN_NOT_FOUND');
    }

    // 2. 사용자 지갑 주소 조회
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('network', 'base')
      .single();

    if (walletError || !walletData) {
      console.error('[burn-fanz-token] Wallet not found:', walletError);
      throw new Error('WALLET_NOT_FOUND');
    }

    const userWallet = walletData.wallet_address;
    console.log(`[burn-fanz-token] User wallet: ${userWallet}`);

    // 3. 온체인 잔액 확인
    const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(FANZTOKEN_CONTRACT_ADDRESS, FANZTOKEN_ABI, provider);

    // tokenId 계산 (UUID -> BigInt)
    const tokenIdHex = fanzToken.token_id.replace(/-/g, '').slice(0, 16);
    const tokenIdBigInt = BigInt('0x' + tokenIdHex);
    
    const onChainBalance = await contract.balanceOf(userWallet, tokenIdBigInt);
    console.log(`[burn-fanz-token] On-chain balance: ${onChainBalance.toString()}`);

    if (onChainBalance < BigInt(amount)) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // 4. 사용자 프라이빗 키 가져오기 (토큰 전송을 위해)
    const { data: keyData, error: keyError } = await supabase
      .from('wallet_private_keys')
      .select('encrypted_private_key')
      .eq('user_id', user.id)
      .single();

    if (keyError || !keyData) {
      console.error('[burn-fanz-token] Private key not found:', keyError);
      throw new Error('PRIVATE_KEY_NOT_FOUND');
    }

    // 5. 프라이빗 키 복호화
    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY_NOT_CONFIGURED');
    }

    // AES-256-GCM 복호화
    const encryptedData = Uint8Array.from(atob(keyData.encrypted_private_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const authTag = encryptedData.slice(-16);
    const encrypted = encryptedData.slice(12, -16);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      keyMaterial,
      new Uint8Array([...encrypted, ...authTag])
    );

    const privateKey = new TextDecoder().decode(decrypted);
    const userSigner = new ethers.Wallet(privateKey, provider);

    // 6. 토큰을 플랫폼 지갑으로 전송 (소각 대신)
    // ERC-1155 표준에서 실제 burn은 owner만 가능하므로, 플랫폼 지갑으로 전송하여 유사한 효과
    const contractWithSigner = new ethers.Contract(FANZTOKEN_CONTRACT_ADDRESS, FANZTOKEN_ABI, userSigner);
    
    console.log(`[burn-fanz-token] Transferring ${amount} tokens to platform wallet...`);
    
    const tx = await contractWithSigner.safeTransferFrom(
      userWallet,
      PLATFORM_WALLET,
      tokenIdBigInt,
      BigInt(amount),
      "0x"
    );

    console.log(`[burn-fanz-token] Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[burn-fanz-token] Transaction confirmed: ${receipt.hash}`);

    // 7. DB에 트랜잭션 기록 (소각/전송 기록)
    await supabase
      .from('fanz_transactions')
      .insert({
        user_id: user.id,
        fanz_token_id: fanzToken.id,
        amount: amount,
        transaction_type: 'burn',
        price_per_token: 0,
        total_value: 0,
        payment_value: 0,
        payment_token: 'BURN',
        tx_hash: receipt.hash,
        platform_fee: 0,
        creator_fee: 0
      });

    console.log(`[burn-fanz-token] Successfully burned ${amount} tokens for reason: ${reason}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        txHash: receipt.hash,
        burnedAmount: amount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[burn-fanz-token] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
