import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ethers } from "https://esm.sh/ethers@6.9.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTNZ 컨트랙트 ABI (mint 함수만)
const KTNZ_ABI = [
  "function mint(address to, uint256 amount) public returns (bool)"
];

const KTNZ_CONTRACT_ADDRESS = Deno.env.get("KTREND_CONTRACT_ADDRESS") ?? "";
const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL") ?? "";

// DAU 기록용 활동 타입
const ACTIVITY_KTNZ_MINT = ethers.keccak256(ethers.toUtf8Bytes("ktnz_mint"));

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
      ACTIVITY_KTNZ_MINT,
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

    console.log("DAU activity recorded for ktnz_mint");
  } catch (e) {
    console.error("DAU recording error:", e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Supabase 클라이언트 생성 (세션 저장 없이 서버 전용)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Authorization 헤더에서 JWT 추출 후 직접 전달
    const token = authHeader.replace('Bearer', '').trim();
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error('Auth verification failed:', userError.message);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    if (!user) {
      console.error('No user found after auth verification');
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log(`Minting daily tokens for user: ${user.id}`);

    // 오늘 이미 토큰을 받았는지 확인
    const today = new Date().toISOString().split('T')[0];
    const { data: existingMint, error: checkError } = await supabaseClient
      .from('point_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('action_type', 'daily_token_mint')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing mint:', checkError);
      throw checkError;
    }

    if (existingMint) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Daily tokens already claimed today',
          message: 'You have already received your daily tokens'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 사용자 프로필 및 레벨 정보 가져오기
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('current_level')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    // 레벨별 토큰 리워드 가져오기
    const { data: level, error: levelError } = await supabaseClient
      .from('levels')
      .select('token_reward, max_daily_votes')
      .eq('id', profile.current_level)
      .single();

    if (levelError || !level || !level.token_reward) {
      throw new Error('Failed to fetch level token reward');
    }

    const tokenAmount = level.token_reward;
    console.log(`User level ${profile.current_level}, minting ${tokenAmount} tokens`);

    // 관리자 클라이언트로 지갑 주소 가져오기 (RLS 우회)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userWallet, error: walletError } = await supabaseAdmin
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('network', 'base')
      .single();

    if (walletError || !userWallet) {
      console.error('Wallet not found for user:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'Wallet not found', 
          message: 'Please create a wallet first by visiting the wallet page.',
          needsWallet: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get minter private key from Supabase Secret (same as exchange-points-to-ktnz)
    const minterPrivateKey = Deno.env.get("MINTER_PRIVATE_KEY");
    if (!minterPrivateKey) {
      throw new Error("MINTER_PRIVATE_KEY not configured in Supabase secrets");
    }

    // Base 네트워크 및 컨트랙트 설정 (다른 함수들과 동일한 설정 사용)
    const contractAddress = KTNZ_CONTRACT_ADDRESS || (Deno.env.get("KTREND_CONTRACT_ADDRESS") ?? "");
    const rpcUrl = BASE_RPC_URL || (Deno.env.get("BASE_RPC_URL") ?? "");

    if (!contractAddress || !rpcUrl) {
      throw new Error("Contract configuration missing");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minterWallet = new ethers.Wallet(minterPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, KTNZ_ABI, minterWallet);

    console.log(`Minter wallet address: ${minterWallet.address}`);

    // 토큰 양을 wei로 변환 (18 decimals)
    const amountInWei = ethers.parseUnits(tokenAmount.toString(), 18);

    console.log(`Minting ${tokenAmount} KTNZ to ${userWallet.wallet_address}`);

    // 민팅 트랜잭션 실행
    const tx = await contract.mint(userWallet.wallet_address, amountInWei);
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction receipt:`, JSON.stringify({
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      hash: receipt.hash
    }));
    
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction failed with status: ${receipt?.status || 'unknown'}`);
    }
    
    console.log(`Transaction confirmed successfully in block ${receipt.blockNumber}`);

    // 트랜잭션이 성공적으로 완료된 경우에만 DB 기록
    console.log(`Recording transaction in database (tx hash: ${receipt.hash})...`);
    
    // 새로 추가된 tx_hash 컬럼에 트랜잭션 해시 저장
    const { error: txError } = await supabaseAdmin.from("point_transactions").insert({
      user_id: user.id,
      action_type: "daily_token_mint",
      points: tokenAmount,
      reference_id: null,
      tx_hash: receipt.hash
    });

    if (txError) {
      console.error('Failed to record transaction:', txError);
      throw new Error('Token minted but failed to record transaction');
    }

    // 알림 생성
    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      type: "tokens_earned",
      title: "Daily Tokens Earned",
      message: `You received ${tokenAmount} KTNZ tokens for completing all daily votes! (Tx: ${receipt.hash.slice(0, 10)}...)`,
      reference_id: null
    });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't throw - notification is not critical
    }
    
    console.log('Database recording completed successfully');

    // DAU 기록 (백그라운드 처리)
    const referenceHash = ethers.keccak256(ethers.solidityPacked(['string'], [receipt.hash]));
    recordDAUActivity(userWallet.wallet_address, referenceHash).catch(e => 
      console.error('DAU recording failed (non-fatal):', e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully minted ${tokenAmount} KTNZ tokens`,
        txHash: receipt.hash,
        amount: tokenAmount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error minting daily tokens:', error);

    const message = error?.message || error?.shortMessage || 'Failed to mint daily tokens';
    const isInsufficientFunds =
      error?.code === 'INSUFFICIENT_FUNDS' ||
      (typeof message === 'string' && message.toLowerCase().includes('insufficient funds for gas'));

    const status = isInsufficientFunds ? 503 : 500;
    const responseBody = isInsufficientFunds
      ? {
          error: 'Insufficient gas for mint transaction',
          message: 'Daily token minting is temporarily unavailable. Please contact support.',
          code: 'INSUFFICIENT_FUNDS',
          details: message,
        }
      : {
          error: message,
          details: error?.toString?.() ?? String(error),
        };

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    );
  }
});
