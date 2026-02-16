// claim-prize-onchain: Backend Smart Account 대납 방식
// - 사용자 지갑 initCode 불필요 (가스비 절감)
// - Backend Smart Account가 distributePrizes를 호출

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzChallenge 컨트랙트 ABI
const CHALLENGE_ABI = [
  "function distributePrizes(uint256 challengeId, address[] calldata winnerAddresses, uint256[] calldata amounts) external",
  "function getParticipation(uint256 challengeId, address participant) view returns (bytes32 answerHash, bool hasLightstick, uint256 timestamp, bool isWinner, bool hasClaimed)",
];

// ERC-4337 상수 (Base Mainnet)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Backend Smart Account (이미 배포됨)
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// USDC decimals
const USDC_DECIMALS = 6;

interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
}

function getUserOpHash(userOp: UserOperation, chainId: bigint): string {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
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
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );
  
  const userOpHashInner = ethers.keccak256(packed);
  
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256'],
      [userOpHashInner, ENTRY_POINT_ADDRESS, chainId]
    )
  );
}

const logStep = (step: string, details?: any) => {
  console.log(`[CLAIM-PRIZE] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId, userId } = await req.json();
    
    logStep('Starting claim prize (Backend delegation via distributePrizes)', { challengeId, userId });

    const contractAddress = Deno.env.get('CHALLENGE_CONTRACT_ADDRESS');
    const paymasterUrl = Deno.env.get('COINBASE_PAYMASTER_URL');
    const operatorPrivateKey = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!contractAddress) throw new Error('CHALLENGE_CONTRACT_ADDRESS not configured');
    if (!paymasterUrl) throw new Error('COINBASE_PAYMASTER_URL not configured');
    if (!operatorPrivateKey) throw new Error('BASE_OPERATOR_PRIVATE_KEY not configured');
    if (!baseRpcUrl) throw new Error('BASE_RPC_URL not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 참여 정보 확인
    const { data: participation, error: partError } = await supabase
      .from('challenge_participations')
      .select('*, challenges!inner(options, onchain_challenge_id, prize_with_lightstick, prize_without_lightstick)')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();

    if (partError || !participation) {
      throw new Error('Participation not found');
    }

    if (!participation.is_winner) {
      throw new Error('Not a winner');
    }

    if (participation.claimed_at) {
      throw new Error('Already claimed');
    }

    // onchain_challenge_id 우선, 없으면 options에서
    const onchainChallengeId = participation.challenges?.onchain_challenge_id 
      || (participation.challenges?.options as any)?.onchain_challenge_id;
    
    if (!onchainChallengeId) {
      throw new Error('Onchain challenge ID not found');
    }

    // 사용자 Smart Wallet 주소 가져오기 (QuestN external wallet 제외)
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', userId)
      .eq('wallet_type', 'smart_wallet')
      .maybeSingle();

    if (walletError || !walletData) {
      throw new Error('User wallet not found');
    }

    const userWalletAddress = ethers.getAddress(walletData.wallet_address.toLowerCase());
    
    // 상금 계산
    const prizeAmount = participation.has_lightstick 
      ? participation.challenges.prize_with_lightstick 
      : participation.challenges.prize_without_lightstick;
    
    // USDC는 6 decimals
    const prizeAmountOnchain = BigInt(Math.floor(prizeAmount * Math.pow(10, USDC_DECIMALS)));

    logStep('Prize details', { 
      userWalletAddress, 
      prizeAmount,
      prizeAmountOnchain: prizeAmountOnchain.toString(),
      hasLightstick: participation.has_lightstick 
    });

    // Backend Operator Wallet 설정 (Alchemy RPC 사용)
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const operatorWallet = new ethers.Wallet(operatorPrivateKey, provider);
    const chainId = 8453n;

    logStep('Backend Smart Account', { address: BACKEND_SMART_ACCOUNT });

    // Backend Smart Account 배포 확인
    const accountCode = await provider.getCode(BACKEND_SMART_ACCOUNT);
    if (accountCode === '0x') {
      throw new Error('Backend Smart Account not deployed. Run deploy-backend-smart-account first.');
    }

    // distributePrizes 함수 callData (단일 사용자 분배)
    const challengeInterface = new ethers.Interface(CHALLENGE_ABI);
    const distributeCallData = challengeInterface.encodeFunctionData('distributePrizes', [
      BigInt(onchainChallengeId),
      [userWalletAddress],           // address[] - 단일 사용자
      [prizeAmountOnchain]           // uint256[] - 해당 금액
    ]);

    // SimpleAccount execute callData
    const executeCallData = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external"
    ]).encodeFunctionData('execute', [
      ethers.getAddress(contractAddress.toLowerCase()),
      0n,
      distributeCallData
    ]);

    // Nonce 조회
    const entryPointContract = new ethers.Contract(
      ENTRY_POINT_ADDRESS,
      ["function getNonce(address sender, uint192 key) view returns (uint256)"],
      provider
    );
    
    const nonce = await entryPointContract.getNonce(BACKEND_SMART_ACCOUNT, 0n);
    logStep('Nonce fetched', { nonce: nonce.toString() });

    // 동적 가스비 계산 (20% 버퍼 적용)
    const feeData = await provider.getFeeData();
    const baseFee = feeData.maxFeePerGas || ethers.parseUnits('0.1', 'gwei');
    const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');
    
    const maxFeePerGas = (baseFee * 120n) / 100n;
    const maxPriorityFeePerGas = (priorityFee * 120n) / 100n;
    
    logStep('Gas fees', {
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    });

    const userOp: UserOperation = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce,
      initCode: '0x', // Backend Smart Account는 이미 배포됨!
      callData: executeCallData + BUILDER_CODE_SUFFIX,
      callGasLimit: 300000n,
      verificationGasLimit: 150000n,
      preVerificationGas: 50000n,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: '0x',
      signature: '0x',
    };

    logStep('Requesting Paymaster sponsorship...');

    // Paymaster 요청
    const paymasterResponse = await fetch(paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterData',
        params: [
          {
            sender: userOp.sender,
            nonce: '0x' + userOp.nonce.toString(16),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: '0x' + userOp.callGasLimit.toString(16),
            verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
            preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
            maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
          },
          ENTRY_POINT_ADDRESS,
          '0x' + chainId.toString(16),
          {}
        ]
      })
    });

    const paymasterResult = await paymasterResponse.json();
    logStep('Paymaster response', paymasterResult);

    if (paymasterResult.error) {
      throw new Error(`Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}`);
    }

    if (paymasterResult.result?.paymasterAndData) {
      userOp.paymasterAndData = paymasterResult.result.paymasterAndData;
    }
    if (paymasterResult.result?.callGasLimit) {
      userOp.callGasLimit = BigInt(paymasterResult.result.callGasLimit);
    }
    if (paymasterResult.result?.verificationGasLimit) {
      userOp.verificationGasLimit = BigInt(paymasterResult.result.verificationGasLimit);
    }
    if (paymasterResult.result?.preVerificationGas) {
      userOp.preVerificationGas = BigInt(paymasterResult.result.preVerificationGas);
    }

    // ERC-191 서명 (Backend Operator가 서명)
    const userOpHash = getUserOpHash(userOp, chainId);
    const signature = await operatorWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    logStep('Submitting UserOperation...');

    // Bundler 제출
    const bundlerResponse = await fetch(paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: userOp.sender,
            nonce: '0x' + userOp.nonce.toString(16),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: '0x' + userOp.callGasLimit.toString(16),
            verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
            preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
            maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          ENTRY_POINT_ADDRESS
        ]
      })
    });

    const bundlerResult = await bundlerResponse.json();
    logStep('Bundler response', bundlerResult);

    if (bundlerResult.error) {
      throw new Error(`Bundler error: ${bundlerResult.error.message || JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashResult = bundlerResult.result;

    // 트랜잭션 영수증 대기
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const receiptResponse = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHashResult]
        })
      });

      const receiptResult = await receiptResponse.json();
      if (receiptResult.result) {
        receipt = receiptResult.result;
        break;
      }
    }

    const txHash = receipt?.receipt?.transactionHash;
    logStep('Transaction confirmed', { txHash });

    // DB 업데이트
    if (txHash) {
      await supabase
        .from('challenge_participations')
        .update({ 
          claimed_at: new Date().toISOString(),
          tx_hash: txHash 
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Prize distributed via Backend delegation (no initCode)',
        data: {
          onchainChallengeId,
          userOpHash: userOpHashResult,
          txHash,
          userWalletAddress,
          prizeAmount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CLAIM-PRIZE] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
