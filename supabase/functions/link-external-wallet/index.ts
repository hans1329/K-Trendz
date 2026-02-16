import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { ethers } from 'https://esm.sh/ethers@6.13.2';
import { createPublicClient, http } from 'https://esm.sh/viem@2.21.7';
import { base } from 'https://esm.sh/viem@2.21.7/chains';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 서명 메시지 생성 (프론트엔드와 동일해야 함)
const SIGN_MESSAGE_PREFIX = 'Sign in to K-Trendz with wallet:\n';

// Smart Wallet Factory 주소 (Coinbase)
const SMART_WALLET_FACTORY = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a';
const FACTORY_ABI = [
  'function getAddress(address[] calldata owners, uint256 nonce) external view returns (address)'
] as const;

// EIP-1271 서명 검증을 위한 ABI
const EIP1271_ABI = [
  'function isValidSignature(bytes32 hash, bytes signature) external view returns (bytes4)'
] as const;
const EIP1271_MAGIC_VALUE = '0x1626ba7e';

// AES-GCM 암호화
async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, signature, nonce, linkToExisting } = await req.json();

    if (!walletAddress || !signature || !nonce) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    console.log('Linking external wallet:', normalizedAddress, 'linkToExisting:', linkToExisting);

    // 로그인된 사용자 확인 (linkToExisting 모드용)
    let currentUserId: string | null = null;
    if (linkToExisting) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await authClient.auth.getUser();
        if (user) {
          currentUserId = user.id;
          console.log('Current user for linking:', currentUserId);
        }
      }
    }

    // 1. 서명 검증 (EOA / Smart Wallet / Counterfactual Smart Wallet 모두 지원)
    const message = `${SIGN_MESSAGE_PREFIX}${normalizedAddress}\n\nNonce: ${nonce}`;

    const rpcUrl =
      Deno.env.get('BASE_RPC_URL') ??
      Deno.env.get('BASE_MAINNET_RPC') ??
      'https://mainnet.base.org';

    let isValidSignature = false;

    // viem: ECDSA + EIP-1271 + ERC-6492(미배포 smart wallet)까지 자동 지원
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(rpcUrl),
      });

      isValidSignature = await publicClient.verifyMessage({
        address: normalizedAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      console.log('Signature verified via viem:', isValidSignature);
    } catch (e) {
      console.error('Viem verifyMessage failed:', e);
    }

    // viem이 실패/미지원인 경우에만 기존 로직으로 fallback
    if (!isValidSignature) {
      try {
        const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
        if (recoveredAddress === normalizedAddress) {
          isValidSignature = true;
          console.log('Signature verified via ECDSA fallback');
        } else {
          console.log('ECDSA recovered address mismatch:', recoveredAddress);
        }
      } catch (e) {
        console.log('ECDSA fallback verification failed');
      }
    }

    if (!isValidSignature) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const code = await provider.getCode(normalizedAddress);

        // 컨트랙트 코드가 있는 경우에만 EIP-1271 시도 (EOA/미배포 계정에서 decode 에러 방지)
        if (code && code !== '0x') {
          const messageHash = ethers.hashMessage(message);
          const contract = new ethers.Contract(normalizedAddress, EIP1271_ABI, provider);
          const result = await contract.isValidSignature(messageHash, signature);

          if (result === EIP1271_MAGIC_VALUE) {
            isValidSignature = true;
            console.log('Signature verified via EIP-1271 fallback');
          } else {
            console.log('EIP-1271 returned:', result);
          }
        } else {
          console.log('No contract code at walletAddress, skipping EIP-1271 fallback');
        }
      } catch (e) {
        console.error('EIP-1271 fallback failed:', e);
      }
    }

    if (!isValidSignature) {
      console.error('All signature verification methods failed');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Signature verified successfully');

    // 2. Supabase 클라이언트 생성 (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === linkToExisting 모드: 현재 로그인된 사용자에게 외부 지갑 연결 ===
    if (linkToExisting && currentUserId) {
      console.log('Linking wallet to existing user:', currentUserId);

      // 이미 다른 유저에게 연결된 지갑인지 확인
      const { data: existingWallet } = await supabase
        .from('wallet_addresses')
        .select('user_id')
        .eq('wallet_address', normalizedAddress)
        .eq('wallet_type', 'external')
        .maybeSingle();

      if (existingWallet && existingWallet.user_id !== currentUserId) {
        return new Response(JSON.stringify({ 
          error: 'This wallet is already linked to another account' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // wallet_addresses에 외부 지갑 추가 (upsert)
      const { error: walletError } = await supabase
        .from('wallet_addresses')
        .upsert({
          user_id: currentUserId,
          wallet_address: normalizedAddress,
          network: 'base',
          wallet_type: 'external',
        }, { 
          onConflict: 'user_id,wallet_type',
          ignoreDuplicates: false 
        });

      if (walletError) {
        console.error('Error adding wallet address:', walletError);
        // duplicate key 에러는 무시
        if (!walletError.message.includes('duplicate')) {
          throw walletError;
        }
      }

      // external_wallet_users도 연결 (있으면)
      await supabase
        .from('external_wallet_users')
        .upsert({
          wallet_address: normalizedAddress,
          linked_user_id: currentUserId,
          source: 'web_link',
        }, { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false 
        });

      console.log('External wallet linked to existing account successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Wallet linked to your account',
        userId: currentUserId,
        walletAddress: normalizedAddress,
        isNewAccount: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === 기존 로직: 새 계정 생성 또는 기존 계정 로그인 ===

    // 3. external_wallet_users 확인
    const { data: externalWallet, error: ewError } = await supabase
      .from('external_wallet_users')
      .select('id, linked_user_id, username, display_name, avatar_url')
      .eq('wallet_address', normalizedAddress)
      .maybeSingle();

    if (ewError) {
      console.error('Error fetching external wallet:', ewError);
      throw ewError;
    }

    // 4. wallet 기반 이메일 (기존/신규 모두 동일 규칙)
    const walletEmail = `${normalizedAddress.slice(2, 10)}@wallet.ktrendz.app`;
    const redirectTo = `${req.headers.get('origin') || 'https://k-trendz.com'}/`;

    // magic link 생성 (클라이언트에서 tokenHash로 세션을 직접 생성할 수 있도록)
    const generateMagicLink = async () => {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: walletEmail,
        options: {
          redirectTo,
        },
      });

      if (linkError) {
        console.error('Error generating magic link:', linkError);
        return { magicLink: null as string | null, tokenHash: null as string | null };
      }

      // 디버깅(민감정보 제외): properties 키/존재 여부만 로깅
      const properties = (linkData?.properties ?? {}) as Record<string, unknown>;
      const propertyKeys = Object.keys(properties);
      console.log('generateLink properties keys:', propertyKeys);

      const actionLink = (properties as any)?.action_link ?? null;

      // Supabase admin.generateLink는 hashed_token을 properties에 포함 (환경/버전에 따라 누락될 수 있음)
      let hashedToken = (properties as any)?.hashed_token ?? null;

      console.log('generateLink has action_link:', !!actionLink);
      console.log('generateLink has hashed_token:', !!hashedToken);

      // hashed_token이 없으면 action_link URL에서 토큰 파라미터 추출 시도
      // (값 자체는 로그에 남기지 않음)
      if (!hashedToken && actionLink) {
        try {
          const url = new URL(actionLink);

          const tokenHashParam = url.searchParams.get('token_hash');
          const tokenParam = url.searchParams.get('token');
          const hashTokenHashMatch = url.hash?.match(/token_hash=([^&]+)/)?.[1] ?? null;
          const hashTokenMatch = url.hash?.match(/token=([^&]+)/)?.[1] ?? null;

          hashedToken = tokenHashParam || tokenParam || hashTokenHashMatch || hashTokenMatch || null;

          console.log(
            'token extracted from action_link:',
            tokenHashParam || hashTokenHashMatch
              ? 'token_hash'
              : tokenParam || hashTokenMatch
                ? 'token'
                : 'none'
          );
        } catch (e) {
          console.error('Failed to parse action_link URL:', e);
        }
      }

      console.log('generateLink returning tokenHash:', !!hashedToken);

      return {
        magicLink: actionLink,
        tokenHash: hashedToken,
      };
    };

    // 이미 연결된 계정이 있는 경우: 링크 토큰을 반환해 클라이언트에서 세션을 직접 생성(iframe 이슈 회피)
    if (externalWallet?.linked_user_id) {
      console.log('Already linked to user:', externalWallet.linked_user_id);

      const { magicLink, tokenHash } = await generateMagicLink();

      return new Response(JSON.stringify({
        success: true,
        message: 'Already linked',
        userId: externalWallet.linked_user_id,
        isExisting: true,
        email: walletEmail,
        magicLink,
        tokenHash,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. 새 계정 생성
    const randomPassword = crypto.randomUUID() + crypto.randomUUID(); // 랜덤 비밀번호 (사용자가 사용 불가)

    console.log('Creating new user with email:', walletEmail);

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: walletEmail,
      password: randomPassword,
      email_confirm: true, // 이메일 확인 생략
      user_metadata: {
        wallet_address: normalizedAddress,
        auth_type: 'external_wallet',
        display_name: externalWallet?.display_name || externalWallet?.username || `Base User`,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      // 이미 존재하는 이메일인 경우 해당 유저 찾기
      if (createError.message.includes('already registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === walletEmail);
        
        if (existingUser) {
          // external_wallet_users 연결
          if (externalWallet) {
            await supabase
              .from('external_wallet_users')
              .update({ linked_user_id: existingUser.id })
              .eq('id', externalWallet.id);
          }
          
           const { magicLink, tokenHash } = await generateMagicLink();

           return new Response(JSON.stringify({ 
             success: true,
             userId: existingUser.id,
             isExisting: true,
             email: walletEmail,
             magicLink,
             tokenHash,
           }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }
      }
      throw createError;
    }

    const userId = newUser.user.id;
    console.log('Created new user:', userId);

    // 5. Profile 생성/업데이트
    const displayName = externalWallet?.display_name || externalWallet?.username || `Base User ${normalizedAddress.slice(0, 8)}`;
    const username = `base_${normalizedAddress.slice(2, 10)}`;
    
    // handle_new_user 트리거가 이미 프로필을 생성했으므로
    // 포인트/레벨은 건드리지 않고 username/display_name만 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username: username,
        display_name: displayName,
        avatar_url: externalWallet?.avatar_url || null,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Profile 생성 실패해도 계속 진행 (trigger가 처리할 수 있음)
    }

    // 6. external_wallet_users 연결
    if (externalWallet) {
      const { error: linkError } = await supabase
        .from('external_wallet_users')
        .update({ linked_user_id: userId })
        .eq('id', externalWallet.id);

      if (linkError) {
        console.error('Error linking external wallet:', linkError);
      }
    } else {
      // external_wallet_users 레코드가 없으면 생성
      await supabase
        .from('external_wallet_users')
        .insert({
          wallet_address: normalizedAddress,
          linked_user_id: userId,
          display_name: displayName,
          source: 'web_signup',
        });
    }

    // 7. wallet_addresses에 외부 지갑 추가
    const { error: walletError } = await supabase
      .from('wallet_addresses')
      .insert({
        user_id: userId,
        wallet_address: normalizedAddress,
        network: 'base',
        wallet_type: 'external',
      });

    if (walletError && !walletError.message.includes('duplicate')) {
      console.error('Error adding wallet address:', walletError);
    }

    // 8. Smart Wallet 생성 (create-smart-wallet 로직 인라인)
    try {
      const rpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
      const encryptionKey = Deno.env.get('SMART_WALLET_ENCRYPTION_KEY');
      
      if (!encryptionKey) {
        console.warn('SMART_WALLET_ENCRYPTION_KEY not set, skipping smart wallet creation');
      } else {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // EOA 지갑 생성
        const eoaWallet = ethers.Wallet.createRandom();
        const eoaAddress = eoaWallet.address;
        console.log('Created EOA for smart wallet:', eoaAddress);
        
        // Smart Wallet 주소 예측 (ethers v6 방식)
        const factoryInterface = new ethers.Interface(FACTORY_ABI);
        const calldata = factoryInterface.encodeFunctionData('getAddress', [[eoaAddress], 0n]);
        const result = await provider.call({
          to: SMART_WALLET_FACTORY,
          data: calldata,
        });
        const smartWalletAddress = ethers.getAddress('0x' + result.slice(-40));
        console.log('Predicted smart wallet address:', smartWalletAddress);
        
        // Private key 암호화
        const encryptedPrivateKey = await encryptPrivateKey(eoaWallet.privateKey, encryptionKey);
        
        // wallet_addresses에 smart_wallet 추가
        const { error: swError } = await supabase
          .from('wallet_addresses')
          .insert({
            user_id: userId,
            wallet_address: smartWalletAddress,
            network: 'base',
            wallet_type: 'smart_wallet',
            encrypted_private_key: encryptedPrivateKey,
            eoa_address: eoaAddress,
          });
        
        if (swError) {
          console.error('Error creating smart wallet record:', swError);
        } else {
          console.log('Smart wallet created successfully');
        }
      }
    } catch (swError) {
      console.error('Error in smart wallet creation:', swError);
      // Smart wallet 생성 실패해도 계속 진행
    }

    // 9. 환영 알림 생성
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'system',
        title: 'Welcome to K-Trendz! 🎉',
        message: 'Your Base wallet has been linked. Enjoy all features of K-Trendz!',
      });

     // 10. magic link (및 tokenHash) 생성
     const { magicLink, tokenHash } = await generateMagicLink();

     console.log('Account linked successfully');

     return new Response(JSON.stringify({ 
       success: true,
       userId: userId,
       email: walletEmail,
       magicLink,
       tokenHash,
       isExisting: false,
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });

  } catch (error: any) {
    console.error('Error in link-external-wallet:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
