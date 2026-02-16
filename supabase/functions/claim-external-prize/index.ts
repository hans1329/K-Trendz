import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 외부 지갑 사용자가 서명으로 미청구 상금 클레임
// 서명 검증 후 Backend Smart Account를 통해 USDC 전송

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAU_CONTRACT_ADDRESS = "0xf7F05cEd0F2c905aD59C370265D67846FAb9959E";
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const DAU_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 data)",
];

const SIMPLE_ACCOUNT_ABI = [
  "function executeBatch(address[] calldata dest, bytes[] calldata func)",
  "function getNonce() view returns (uint256)",
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
  return '0x' + hex;
}

function getUserOpHash(userOp: UserOperation, chainId: bigint): string {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
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
  const userOpHashInner = ethers.keccak256(packed);
  const fullEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHashInner, ENTRY_POINT_ADDRESS, chainId]
  );
  return ethers.keccak256(fullEncoded);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participationId, walletAddress, message, signature } = await req.json();

    console.log('Claiming external prize:', { participationId, walletAddress });

    if (!participationId || !walletAddress || !message || !signature) {
      throw new Error('Missing required parameters');
    }

    // 1. 서명 검증
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Invalid signature - wallet address mismatch');
    }
    console.log('Signature verified for:', recoveredAddress);

    // Environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const paymasterUrl = Deno.env.get('COINBASE_PAYMASTER_URL');
    const privateKey = Deno.env.get('BACKEND_WALLET_PRIVATE_KEY');
    // Alchemy RPC 우선 사용
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    const rpcUrl = alchemyKey 
      ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : (Deno.env.get('BASE_MAINNET_RPC') || 'https://mainnet.base.org');

    if (!paymasterUrl || !privateKey) {
      throw new Error('Missing COINBASE_PAYMASTER_URL or BACKEND_WALLET_PRIVATE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const ownerWallet = new ethers.Wallet(privateKey, provider);

    // 2. 참여 정보 조회
    const { data: participation, error: partError } = await supabase
      .from('external_challenge_participations')
      .select(`
        id,
        challenge_id,
        external_wallet_id,
        is_winner,
        claimed_at,
        prize_amount,
        external_wallet_users!inner (
          wallet_address
        )
      `)
      .eq('id', participationId)
      .single();

    if (partError || !participation) {
      throw new Error('Participation not found');
    }

    // 3. 검증
    if (!participation.is_winner) {
      throw new Error('Not a winner');
    }

    if (participation.claimed_at) {
      throw new Error('Prize already claimed');
    }

    const storedAddress = (participation as any).external_wallet_users?.wallet_address;
    if (!storedAddress || storedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Wallet address mismatch with participation record');
    }

    const prizeAmount = participation.prize_amount || 0;
    if (prizeAmount <= 0) {
      throw new Error('No prize amount');
    }

    console.log(`Processing claim: $${prizeAmount} USDC to ${walletAddress}`);

    // 4. USDC 잔액 확인
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const poolBalance = await usdcContract.balanceOf(BACKEND_SMART_ACCOUNT);
    const amountWei = BigInt(Math.round(prizeAmount * 1e6));

    if (poolBalance < amountWei) {
      throw new Error('Insufficient pool balance for prize distribution');
    }

    // 5. 트랜잭션 준비
    const dauContract = new ethers.Contract(DAU_CONTRACT_ADDRESS, DAU_ABI, provider);
    const smartAccountContract = new ethers.Contract(BACKEND_SMART_ACCOUNT, SIMPLE_ACCOUNT_ABI, provider);

    const PRIZE_CLAIM_HASH = ethers.keccak256(ethers.toUtf8Bytes("PRIZE_CLAIM"));
    const challengeIdHash = ethers.keccak256(ethers.toUtf8Bytes(participation.challenge_id));

    // USDC transfer + DAU record
    const destinations = [USDC_ADDRESS, DAU_CONTRACT_ADDRESS];
    const callDatas = [
      usdcContract.interface.encodeFunctionData('transfer', [walletAddress, amountWei]),
      dauContract.interface.encodeFunctionData('recordActivity', [walletAddress, PRIZE_CLAIM_HASH, challengeIdHash]),
    ];

    const executeBatchData = smartAccountContract.interface.encodeFunctionData('executeBatch', [destinations, callDatas]);

    // Get nonce
    const nonce = await smartAccountContract.getNonce();
    console.log(`Backend SA nonce: ${nonce.toString()}`);

    // Get gas fees
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n / 100n) : ethers.parseUnits('1', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 120n / 100n) : ethers.parseUnits('0.1', 'gwei');

    // Build UserOperation
    const userOp: UserOperation = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce: toRpcHex(nonce),
      initCode: '0x',
      callData: executeBatchData,
      callGasLimit: toRpcHex(400000n),
      verificationGasLimit: toRpcHex(150000n),
      preVerificationGas: toRpcHex(60000n),
      maxFeePerGas: toRpcHex(maxFeePerGas),
      maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
      paymasterAndData: '0x',
      signature: '0x',
    };

    // 6. Paymaster 후원 요청
    console.log('Requesting Paymaster sponsorship...');
    const paymasterResponse = await fetch(paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterData',
        params: [userOp, ENTRY_POINT_ADDRESS, toRpcHex(8453n)],
      }),
    });

    const paymasterData = await paymasterResponse.json();
    if (paymasterData.error) {
      throw new Error(`Paymaster error: ${JSON.stringify(paymasterData.error)}`);
    }

    userOp.paymasterAndData = paymasterData.result.paymasterAndData;
    if (paymasterData.result.callGasLimit) userOp.callGasLimit = paymasterData.result.callGasLimit;
    if (paymasterData.result.verificationGasLimit) userOp.verificationGasLimit = paymasterData.result.verificationGasLimit;
    if (paymasterData.result.preVerificationGas) userOp.preVerificationGas = paymasterData.result.preVerificationGas;

    // 7. 서명 및 전송
    const userOpHash = getUserOpHash(userOp, 8453n);
    const opSignature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = opSignature;

    console.log('Submitting UserOperation to Bundler...');
    const sendResponse = await fetch(paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, ENTRY_POINT_ADDRESS],
      }),
    });

    const sendResult = await sendResponse.json();
    if (sendResult.error) {
      throw new Error(`Bundler error: ${JSON.stringify(sendResult.error)}`);
    }

    const userOpHashResult = sendResult.result;
    console.log(`UserOperation submitted: ${userOpHashResult}`);

    // 8. 영수증 대기
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const receiptResponse = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHashResult],
        }),
      });

      const receiptResult = await receiptResponse.json();
      if (receiptResult.result) {
        receipt = receiptResult.result;
        break;
      }
    }

    if (!receipt) {
      throw new Error('Transaction not confirmed in time');
    }

    const txHash = receipt.receipt?.transactionHash;
    console.log(`Transaction confirmed: ${txHash}`);

    const success = receipt.success === true || receipt.success === '0x1' || receipt.success === 1;
    if (!success) {
      throw new Error('Transaction reverted on-chain');
    }

    // 9. DB 업데이트
    const { error: updateError } = await supabase
      .from('external_challenge_participations')
      .update({
        claimed_at: new Date().toISOString(),
        prize_tx_hash: txHash,
      })
      .eq('id', participationId);

    if (updateError) {
      console.error('Failed to update participation:', updateError);
    }

    console.log('External prize claim completed:', {
      participationId,
      walletAddress,
      prizeAmount,
      txHash,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prize claimed successfully`,
        data: {
          amount: prizeAmount,
          txHash,
          walletAddress,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error claiming external prize:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
