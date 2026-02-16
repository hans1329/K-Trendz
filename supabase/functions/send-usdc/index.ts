// send-usdc: Backend Smart Account 대납 방식
// - 사용자 지갑 initCode 불필요 (가스비 절감)
// - Backend Smart Account가 USDC를 대신 전송
// - 사용자의 usdc_balances에서 차감 후 Backend pool에서 전송

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.7.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// USDC on Base Mainnet
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// 수수료 설정 ($0.10 고정)
const WITHDRAWAL_FEE_USD = 0.1;

// ERC-4337 Constants (Base Mainnet)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Backend Smart Account (이미 배포됨)
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

const toRpcHex = (value: bigint | number) => {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return "0x" + v.toString(16);
};

const logStep = (step: string, details?: any) => {
  console.log(`[SEND-USDC] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started (Backend delegation)");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server configuration error');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('User not authenticated');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[SEND-USDC] Auth error:', authError);
      throw new Error('User not authenticated');
    }

    const { toAddress, amount } = await req.json();

    if (!toAddress || !amount) {
      throw new Error('Missing required parameters: toAddress, amount');
    }

    const amountNumber = parseFloat(amount);

    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid wallet address');
    }

    // 환경 변수
    const BASE_RPC_URL = Deno.env.get('BASE_RPC_URL') ?? Deno.env.get('BASE_MAINNET_RPC');
    const PAYMASTER_URL = Deno.env.get('COINBASE_PAYMASTER_URL');
    const OPERATOR_PRIVATE_KEY = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const WITHDRAWAL_FEE_RECIPIENT_ADDRESS = Deno.env.get('WITHDRAWAL_FEE_RECIPIENT_ADDRESS');

    if (!BASE_RPC_URL || !PAYMASTER_URL || !OPERATOR_PRIVATE_KEY || !WITHDRAWAL_FEE_RECIPIENT_ADDRESS) {
      throw new Error('Server configuration error');
    }

    // 사용자의 USDC 잔액 확인 (DB에서)
    const { data: balanceData, error: balanceError } = await supabaseClient
      .from('usdc_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (balanceError || !balanceData) {
      throw new Error('USDC balance not found');
    }

    const userBalance = balanceData.balance;
    
    // 수수료 계산
    const totalFee = WITHDRAWAL_FEE_USD;
    
    if (amountNumber <= totalFee) {
      throw new Error(`Amount must be greater than $${totalFee} (transfer fee)`);
    }

    if (userBalance < amountNumber) {
      throw new Error(`Insufficient USDC balance. Available: $${userBalance.toFixed(2)}`);
    }

    const netAmount = amountNumber - totalFee;
    const feeAmount = totalFee;

    logStep("Balance and fee check", {
      userBalance,
      requestedAmount: amountNumber,
      fee: feeAmount,
      netAmount,
    });

    // DB에서 잔액 차감 (atomic)
    const { error: deductError } = await supabaseClient.rpc('process_usdc_withdrawal', {
      p_user_id: user.id,
      p_amount: amountNumber,
      p_fee: feeAmount,
    });

    if (deductError) {
      throw new Error(`Failed to deduct balance: ${deductError.message}`);
    }

    logStep("Balance deducted from DB");

    // Backend Operator Wallet 설정
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
    const chainId = 8453n;

    logStep('Backend Smart Account', { address: BACKEND_SMART_ACCOUNT });

    // Backend Smart Account 배포 확인
    const accountCode = await provider.getCode(BACKEND_SMART_ACCOUNT);
    if (accountCode === '0x') {
      // 롤백
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_user_id: user.id,
        p_amount: amountNumber,
        p_fee: feeAmount,
      });
      throw new Error('Backend Smart Account not deployed. Run deploy-backend-smart-account first.');
    }

    // Backend Smart Account USDC 잔액 확인
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      ["function balanceOf(address) view returns (uint256)", "function transfer(address, uint256) returns (bool)"],
      provider
    );
    
    const poolBalance = await usdcContract.balanceOf(BACKEND_SMART_ACCOUNT);
    const netTransferAmount = BigInt(Math.floor(netAmount * Math.pow(10, USDC_DECIMALS)));
    const feeTransferAmount = BigInt(Math.floor(feeAmount * Math.pow(10, USDC_DECIMALS)));
    const totalOnchainNeeded = netTransferAmount + feeTransferAmount;
    
    logStep("Pool balance check", {
      poolBalance: ethers.formatUnits(poolBalance, USDC_DECIMALS),
      totalNeeded: ethers.formatUnits(totalOnchainNeeded, USDC_DECIMALS),
    });

    if (poolBalance < totalOnchainNeeded) {
      // 롤백
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_user_id: user.id,
        p_amount: amountNumber,
        p_fee: feeAmount,
      });
      throw new Error('Insufficient USDC in withdrawal pool. Please try again later.');
    }

    // 수신자 및 수수료 수신자 주소
    const recipientAddress = ethers.getAddress(toAddress);
    const feeRecipientAddress = ethers.getAddress(WITHDRAWAL_FEE_RECIPIENT_ADDRESS.toLowerCase());

    // Transfer callData
    const userTransferCallData = usdcContract.interface.encodeFunctionData('transfer', [recipientAddress, netTransferAmount]);
    const feeTransferCallData = usdcContract.interface.encodeFunctionData('transfer', [feeRecipientAddress, feeTransferAmount]);

    // SimpleAccount executeBatch callData
    const executeBatchCallData = new ethers.Interface([
      "function executeBatch(address[] calldata dest, bytes[] calldata func) external"
    ]).encodeFunctionData('executeBatch', [
      [USDC_ADDRESS, USDC_ADDRESS],
      [userTransferCallData, feeTransferCallData]
    ]);

    logStep("Preparing batch transfer", {
      userAmount: netAmount,
      feeAmount: feeAmount,
      userRecipient: recipientAddress,
      feeRecipient: feeRecipientAddress,
    });

    // Nonce 조회
    const entryPointContract = new ethers.Contract(
      ENTRY_POINT_ADDRESS,
      ["function getNonce(address sender, uint192 key) view returns (uint256)"],
      provider
    );
    const nonce = await entryPointContract.getNonce(BACKEND_SMART_ACCOUNT, 0);
    logStep("Nonce fetched", { nonce: nonce.toString() });

    // 동적 가스비 계산
    const feeData = await provider.getFeeData();
    const suggestedMaxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
    const suggestedMaxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');

    const rawMaxFeePerGas = (suggestedMaxFeePerGas * 120n) / 100n;
    const rawMaxPriorityFeePerGas = (suggestedMaxPriorityFeePerGas * 120n) / 100n;

    const maxFeeCap = ethers.parseUnits('3', 'gwei');
    const maxPriorityFeeCap = ethers.parseUnits('1', 'gwei');

    const maxFeePerGas = rawMaxFeePerGas > maxFeeCap ? maxFeeCap : rawMaxFeePerGas;
    const maxPriorityFeePerGas = rawMaxPriorityFeePerGas > maxPriorityFeeCap ? maxPriorityFeeCap : rawMaxPriorityFeePerGas;

    // UserOperation 구성
    const userOp: UserOperation = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce: nonce,
      initCode: '0x', // Backend Smart Account는 이미 배포됨!
      callData: executeBatchCallData + BUILDER_CODE_SUFFIX,
      callGasLimit: 200000n,
      verificationGasLimit: 150000n, // initCode 없으므로 낮춤
      preVerificationGas: 50000n,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      paymasterAndData: '0x',
      signature: '0x',
    };

    // Paymaster 스폰서십 요청
    logStep('Requesting Paymaster sponsorship...');
    const paymasterResponse = await fetch(PAYMASTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterData',
        params: [
          {
            sender: userOp.sender,
            nonce: toRpcHex(userOp.nonce),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: toRpcHex(userOp.callGasLimit),
            verificationGasLimit: toRpcHex(userOp.verificationGasLimit),
            preVerificationGas: toRpcHex(userOp.preVerificationGas),
            maxFeePerGas: toRpcHex(userOp.maxFeePerGas),
            maxPriorityFeePerGas: toRpcHex(userOp.maxPriorityFeePerGas),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          ENTRY_POINT_ADDRESS,
          toRpcHex(chainId),
          {},
        ],
      }),
    });

    const paymasterResult = await paymasterResponse.json();
    logStep('Paymaster response', paymasterResult);

    if (paymasterResult.error) {
      // 롤백
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_user_id: user.id,
        p_amount: amountNumber,
        p_fee: feeAmount,
      });
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
    const bundlerResponse = await fetch(PAYMASTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: userOp.sender,
            nonce: toRpcHex(userOp.nonce),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: toRpcHex(userOp.callGasLimit),
            verificationGasLimit: toRpcHex(userOp.verificationGasLimit),
            preVerificationGas: toRpcHex(userOp.preVerificationGas),
            maxFeePerGas: toRpcHex(userOp.maxFeePerGas),
            maxPriorityFeePerGas: toRpcHex(userOp.maxPriorityFeePerGas),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          ENTRY_POINT_ADDRESS,
        ],
      }),
    });

    const bundlerResult = await bundlerResponse.json();
    logStep('Bundler response', bundlerResult);

    if (bundlerResult.error) {
      // 롤백
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_user_id: user.id,
        p_amount: amountNumber,
        p_fee: feeAmount,
      });
      throw new Error(`Bundler error: ${bundlerResult.error.message || JSON.stringify(bundlerResult.error)}`);
    }

    const userOpHashResult = bundlerResult.result;

    // 트랜잭션 영수증 대기
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const receiptResponse = await fetch(PAYMASTER_URL, {
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

    const txHash = receipt?.receipt?.transactionHash;
    logStep('Transaction confirmed', { txHash });

    // 전송 기록 저장
    if (txHash) {
      await supabaseClient.from('usdc_transfers').insert({
        user_id: user.id,
        to_address: recipientAddress,
        amount: netAmount,
        fee: feeAmount,
        tx_hash: txHash,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'USDC sent via Backend delegation (no initCode)',
        data: {
          txHash,
          userOpHash: userOpHashResult,
          amount: netAmount,
          fee: feeAmount,
          recipient: recipientAddress,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SEND-USDC] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
