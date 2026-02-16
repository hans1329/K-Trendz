import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ethers } from "https://esm.sh/ethers@6.9.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES 복호화 함수
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltHex, ivHex, encryptedHex] = parts;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(encryptionKey),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[send-eth] Request received');

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 사용자 인증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[send-eth] Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('[send-eth] User authenticated:', user.id);

    // 요청 본문 파싱
    const { toAddress, amount } = await req.json();
    
    if (!toAddress || !amount) {
      throw new Error('Missing required parameters: toAddress, amount');
    }

    console.log('[send-eth] Sending', amount, 'ETH to', toAddress);

    // 사용자 Smart Wallet 주소 가져오기 (QuestN external wallet 제외)
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('wallet_type', 'smart_wallet')
      .maybeSingle();

    if (walletError || !walletData) {
      console.error('[send-eth] Wallet not found:', walletError);
      throw new Error('Wallet not found');
    }

    const userWalletAddress = walletData.wallet_address;
    console.log('[send-eth] User wallet:', userWalletAddress);

    // 암호화된 개인키 가져오기
    const { data: keyData, error: keyError } = await supabase
      .from('wallet_private_keys')
      .select('encrypted_private_key')
      .eq('user_id', user.id)
      .single();

    if (keyError || !keyData) {
      console.error('[send-eth] Private key not found:', keyError);
      throw new Error('Private key not found');
    }

    // 개인키 복호화
    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    let privateKey: string;
    try {
      // 새 형식(암호화됨) 시도
      privateKey = await decryptPrivateKey(keyData.encrypted_private_key, encryptionKey);
      console.log('[send-eth] Private key decrypted successfully');
    } catch (decryptError) {
      // 구 형식(평문) fallback
      console.log('[send-eth] Decryption failed, trying legacy format');
      privateKey = keyData.encrypted_private_key;
    }

    // Provider 및 Wallet 초기화
    const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 지갑 주소 확인
    if (wallet.address.toLowerCase() !== userWalletAddress.toLowerCase()) {
      console.error('[send-eth] Wallet address mismatch');
      throw new Error('Wallet address mismatch');
    }

    console.log('[send-eth] Wallet initialized:', wallet.address);

    // ETH 잔액 확인
    const balance = await provider.getBalance(wallet.address);
    const amountWei = ethers.parseEther(amount.toString());
    
    console.log('[send-eth] Current balance:', ethers.formatEther(balance), 'ETH');
    console.log('[send-eth] Amount to send:', ethers.formatEther(amountWei), 'ETH');

    // 가스비 추정
    const gasLimit = 21000n; // ETH 전송의 기본 가스 한도
    const feeData = await provider.getFeeData();
    const estimatedGasCost = gasLimit * (feeData.maxFeePerGas || feeData.gasPrice || 0n);
    
    console.log('[send-eth] Estimated gas cost:', ethers.formatEther(estimatedGasCost), 'ETH');

    // 잔액 체크 (전송량 + 가스비)
    const totalRequired = amountWei + estimatedGasCost;
    if (balance < totalRequired) {
      const shortfall = totalRequired - balance;
      throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(totalRequired)} ETH (${ethers.formatEther(amountWei)} + ${ethers.formatEther(estimatedGasCost)} gas), but have ${ethers.formatEther(balance)} ETH. Short by ${ethers.formatEther(shortfall)} ETH.`);
    }

    // ETH 전송 트랜잭션 생성 및 전송
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
    });

    console.log('[send-eth] Transaction sent:', tx.hash);

    // 트랜잭션 확인 대기
    const receipt = await tx.wait();
    console.log('[send-eth] Transaction confirmed:', receipt?.hash);

    return new Response(
      JSON.stringify({
        success: true,
        txHash: receipt?.hash,
        from: wallet.address,
        to: toAddress,
        amount: amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[send-eth] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send ETH',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
