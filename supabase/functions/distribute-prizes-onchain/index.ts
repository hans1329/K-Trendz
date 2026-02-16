import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzChallenge 컨트랙트 ABI (distributePrizes 함수)
const CHALLENGE_ABI = [
  "function distributePrizes(uint256 challengeId, address[] calldata winnerAddresses, uint256[] calldata amounts) external",
  "function getParticipation(uint256 challengeId, address participant) view returns (bytes32 answerHash, bool hasLightstick, uint256 timestamp, bool isWinner, bool hasClaimed)",
];

// USDC 컨트랙트 ABI
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

// Base Mainnet USDC 주소
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ERC-4337 상수 (Base Mainnet)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";
// Alchemy RPC 우선 사용
const getBaseRpcUrl = () => {
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  if (alchemyKey) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  return Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
};
const BASE_RPC_URL = getBaseRpcUrl();

// Backend Smart Account 주소 (사전 계산됨)
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

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

// UserOperation 해시 계산
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      challengeId, 
      onchainChallengeId, 
      winners // Array of { address: string, amount: number (USDC) }
    } = await req.json();

    console.log('Distributing prizes onchain (gasless via Paymaster):', { 
      challengeId, 
      onchainChallengeId, 
      winnerCount: winners?.length 
    });

    // 환경 변수
    const contractAddress = Deno.env.get('CHALLENGE_CONTRACT_ADDRESS');
    const operatorPrivateKey = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const paymasterUrl = Deno.env.get('COINBASE_PAYMASTER_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!contractAddress) {
      throw new Error('CHALLENGE_CONTRACT_ADDRESS not configured');
    }
    if (!operatorPrivateKey) {
      throw new Error('BASE_OPERATOR_PRIVATE_KEY not configured');
    }
    if (!paymasterUrl) {
      throw new Error('COINBASE_PAYMASTER_URL not configured');
    }
    if (!winners || winners.length === 0) {
      throw new Error('Winners array required');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Provider 설정 (별도 RPC - Paymaster와 분리)
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const chainId = 8453n;

    // Operator 지갑 설정
    const operatorWallet = new ethers.Wallet(operatorPrivateKey);
    console.log('Operator wallet:', operatorWallet.address);
    console.log('Backend Smart Account:', BACKEND_SMART_ACCOUNT);

    // USDC 컨트랙트
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

    // onchainChallengeId가 없으면 DB에서 가져오기 (컬럼 우선, fallback으로 options)
    let finalOnchainId = onchainChallengeId;
    if (!finalOnchainId) {
      const { data: challenge } = await supabase
        .from('challenges')
        .select('onchain_challenge_id, options')
        .eq('id', challengeId)
        .single();
      
      // 새 컬럼 우선, 없으면 options에서 확인
      finalOnchainId = challenge?.onchain_challenge_id;
      if (!finalOnchainId) {
        const options = challenge?.options as any;
        finalOnchainId = options?.onchain_challenge_id;
      }
      
      if (!finalOnchainId) {
        throw new Error('Onchain challenge ID not found. Create challenge onchain first.');
      }
    }

    // 컨트랙트의 USDC 잔액 확인
    const contractBalance = await usdcContract.balanceOf(contractAddress);
    console.log('Contract USDC balance:', ethers.formatUnits(contractBalance, 6));

    // 총 필요 상금 계산
    const totalNeeded = winners.reduce((sum: bigint, w: any) => 
      sum + ethers.parseUnits(String(w.amount), 6), 0n);
    
    console.log('Total prizes to distribute:', ethers.formatUnits(totalNeeded, 6), 'USDC');

    if (contractBalance < totalNeeded) {
      throw new Error(`Insufficient contract balance. Have: ${ethers.formatUnits(contractBalance, 6)}, Need: ${ethers.formatUnits(totalNeeded, 6)}`);
    }

    // 주소와 금액 배열 준비
    const winnerAddresses: string[] = [];
    const amounts: bigint[] = [];

    for (const winner of winners) {
      if (ethers.isAddress(winner.address)) {
        winnerAddresses.push(winner.address);
        amounts.push(ethers.parseUnits(String(winner.amount), 6));
      }
    }

    if (winnerAddresses.length === 0) {
      throw new Error('No valid winner addresses provided');
    }

    console.log(`Preparing to distribute to ${winnerAddresses.length} winners via Paymaster...`);

    // distributePrizes 함수 callData 생성
    const challengeInterface = new ethers.Interface(CHALLENGE_ABI);
    const distributePrizesCallData = challengeInterface.encodeFunctionData('distributePrizes', [
      BigInt(finalOnchainId),
      winnerAddresses,
      amounts
    ]);

    // SimpleAccount execute 함수 callData
    const executeCallData = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external"
    ]).encodeFunctionData('execute', [
      contractAddress,
      0n,
      distributePrizesCallData
    ]);

    // Nonce 조회
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)"
    ]);
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointInterface, provider);
    
    let nonce = 0n;
    try {
      nonce = await entryPoint.getNonce(BACKEND_SMART_ACCOUNT, 0n);
      console.log('Backend Smart Account nonce:', nonce.toString());
    } catch (e) {
      console.log('Error getting nonce, using 0:', e);
    }

    // initCode (Backend Smart Account는 이미 배포됨)
    const initCode = '0x';
    const accountCode = await provider.getCode(BACKEND_SMART_ACCOUNT);
    if (accountCode === '0x') {
      throw new Error('Backend Smart Account not deployed. Run deploy-backend-smart-account first.');
    }

    // 동적 가스비 계산 (20% 버퍼 적용 - 성공 패턴)
    const feeData = await provider.getFeeData();
    const baseFee = feeData.maxFeePerGas || ethers.parseUnits('0.1', 'gwei');
    const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');
    
    // 20% 버퍼 적용
    const maxFeePerGas = (baseFee * 120n) / 100n;
    const maxPriorityFeePerGas = (priorityFee * 120n) / 100n;
    
    console.log('Gas fees (with 20% buffer):', {
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    });

    // distributePrizes는 여러 USDC 전송을 포함하므로 가스 한도 상향
    const baseGas = 200000n;
    const perWinnerGas = 50000n; // 각 당첨자당 추가 가스
    const callGasLimit = baseGas + (BigInt(winnerAddresses.length) * perWinnerGas);

    const userOp: UserOperation = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce,
      initCode,
      callData: executeCallData + BUILDER_CODE_SUFFIX,
      callGasLimit,
      verificationGasLimit: 200000n,
      preVerificationGas: 60000n,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: '0x',
      signature: '0x',
    };

    console.log('Requesting Paymaster sponsorship (pm_getPaymasterData)...');

    // Paymaster 요청 (pm_getPaymasterData 사용 - 성공 패턴)
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
    console.log('Paymaster response:', JSON.stringify(paymasterResult));

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

    // ERC-191 서명 (성공 패턴)
    const userOpHash = getUserOpHash(userOp, chainId);
    const signature = await operatorWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    console.log('Submitting UserOperation to Bundler...');

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
    console.log('Bundler response:', JSON.stringify(bundlerResult));

    if (bundlerResult.error) {
      throw new Error(`Bundler error: ${bundlerResult.error.message || JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashResult = bundlerResult.result;
    console.log('UserOperation hash:', userOpHashResult);

    // 트랜잭션 영수증 대기 (최대 60초)
    let receipt = null;
    let txHash = null;
    for (let i = 0; i < 60; i++) {
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
        txHash = receipt?.receipt?.transactionHash;
        console.log('Transaction confirmed:', txHash);
        break;
      }
      
      if (i % 10 === 0) {
        console.log(`Waiting for receipt... ${i}s`);
      }
    }

    if (!txHash) {
      console.warn('Transaction receipt not received within timeout, but UserOp was submitted');
    }

    // 분배 후 컨트랙트 잔액
    const newBalance = await usdcContract.balanceOf(contractAddress);
    console.log('Contract USDC balance after:', ethers.formatUnits(newBalance, 6));

    // DB에 분배 완료 기록 (challenge_participations의 claimed_at 업데이트)
    for (const winner of winners) {
      const { data: walletData } = await supabase
        .from('wallet_addresses')
        .select('user_id')
        .eq('wallet_address', winner.address.toLowerCase())
        .single();
      
      if (walletData?.user_id) {
        await supabase
          .from('challenge_participations')
          .update({ 
            claimed_at: new Date().toISOString(),
            tx_hash: txHash || null
          })
          .eq('challenge_id', challengeId)
          .eq('user_id', walletData.user_id)
          .eq('is_winner', true);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Prizes distributed onchain (gasless via Paymaster)',
        data: {
          userOpHash: userOpHashResult,
          txHash,
          onchainChallengeId: finalOnchainId,
          distributedCount: winnerAddresses.length,
          totalDistributed: ethers.formatUnits(totalNeeded, 6),
          contractBalanceAfter: ethers.formatUnits(newBalance, 6),
          smartAccountUsed: BACKEND_SMART_ACCOUNT,
          contractAddress,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error distributing prizes onchain:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
