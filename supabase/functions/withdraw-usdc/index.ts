import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// USDC on Base Mainnet
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// Backend Smart Account (operator 역할)
// NOTE: deploy-backend-smart-account Edge Function이 반환하는 실제 운영 주소와 반드시 일치해야 함
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// ERC-4337 Entry Point
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// 수수료 설정 ($0.50 고정)
const WITHDRAWAL_FEE_USD = 0.5;

// 1회 최대 출금 한도 ($100)
const MAX_WITHDRAWAL_AMOUNT = 100;

// USDC 컨트랙트 ABI
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Simple Account ABI (executeBatch)
const SIMPLE_ACCOUNT_ABI = [
  "function executeBatch(address[] calldata dest, bytes[] calldata func) external",
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function getNonce() view returns (uint256)",
];

// UserOperation 인터페이스
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

// 유틸리티 함수
const toRpcHex = (value: bigint | number): string => {
  const hex = BigInt(value).toString(16);
  return hex === '0' ? '0x0' : `0x${hex}`;
};

const getUserOpHash = (userOp: UserOperation, chainId: bigint): string => {
  const packedUserOp = ethers.AbiCoder.defaultAbiCoder().encode(
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
  const userOpHashInner = ethers.keccak256(packedUserOp);
  const fullEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHashInner, ENTRY_POINT, chainId]
  );
  return ethers.keccak256(fullEncoded);
};

const logStep = (step: string, details?: any) => {
  console.log(`[WITHDRAW-USDC] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server configuration error');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('User not authenticated');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[WITHDRAW-USDC] Auth error:', authError);
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

    // 최소 출금 금액 확인 (수수료보다 커야 함)
    if (amountNumber <= WITHDRAWAL_FEE_USD) {
      throw new Error(`Amount must be greater than $${WITHDRAWAL_FEE_USD} (withdrawal fee)`);
    }

    // 1회 최대 출금 한도 검사
    if (amountNumber > MAX_WITHDRAWAL_AMOUNT) {
      throw new Error(`Maximum withdrawal amount is $${MAX_WITHDRAWAL_AMOUNT} per transaction`);
    }

    // 수수료 계산
    const netAmount = amountNumber - WITHDRAWAL_FEE_USD;
    const feeAmount = WITHDRAWAL_FEE_USD;

    // 🔒 Atomic 출금 처리 (Race Condition 방지, 중복 출금 차단, 한도 검사)
    const { data: withdrawalResult, error: withdrawalError } = await supabaseClient
      .rpc('process_usdc_withdrawal', {
        p_user_id: user.id,
        p_amount: amountNumber,
        p_fee: feeAmount,
        p_to_address: toAddress,
      });

    if (withdrawalError) {
      throw new Error(`Withdrawal processing failed: ${withdrawalError.message}`);
    }

    const result = withdrawalResult?.[0];
    if (!result?.success) {
      throw new Error(result?.error_message || 'Withdrawal failed');
    }

    const txRecordId = result.transaction_id;
    const currentBalance = result.previous_balance;
    const newBalance = result.new_balance;

    logStep("Atomic withdrawal processed", {
      requestedAmount: amountNumber,
      fee: feeAmount,
      netAmount,
      previousBalance: currentBalance,
      newBalance,
      transactionId: txRecordId,
    });

    // 환경 변수
    const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');
    const BASE_RPC_URL = ALCHEMY_API_KEY 
      ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : (Deno.env.get('BASE_RPC_URL') ?? Deno.env.get('BASE_MAINNET_RPC') ?? 'https://mainnet.base.org');
    const PAYMASTER_URL = Deno.env.get('COINBASE_PAYMASTER_URL');
    const OPERATOR_PRIVATE_KEY = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const FEE_RECIPIENT_ADDRESS = Deno.env.get('WITHDRAWAL_FEE_RECIPIENT_ADDRESS') || '0xa98fA3f3Ba861F6b81f07EE4c4eDb90ea30e0C31';

    if (!OPERATOR_PRIVATE_KEY) {
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_transaction_id: txRecordId,
        p_user_id: user.id,
      });
      throw new Error('Server configuration error: Missing OPERATOR_PRIVATE_KEY');
    }

    if (!PAYMASTER_URL) {
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_transaction_id: txRecordId,
        p_user_id: user.id,
      });
      throw new Error('Server configuration error: Missing COINBASE_PAYMASTER_URL');
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
    const chainId = 8453n; // Base Mainnet

    logStep("Using Backend Smart Account for direct USDC transfer", { address: BACKEND_SMART_ACCOUNT });

    // Backend Smart Account의 USDC 잔액 확인
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const accountContract = new ethers.Contract(BACKEND_SMART_ACCOUNT, SIMPLE_ACCOUNT_ABI, provider);
    
    const totalTransferAmount = BigInt(Math.floor(amountNumber * Math.pow(10, USDC_DECIMALS)));
    const smartAccountBalance = await usdcContract.balanceOf(BACKEND_SMART_ACCOUNT);
    
    logStep("Backend Smart Account USDC balance check", {
      smartAccountBalance: ethers.formatUnits(smartAccountBalance, USDC_DECIMALS),
      totalTransferNeeded: amountNumber,
    });

    if (smartAccountBalance < totalTransferAmount) {
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_transaction_id: txRecordId,
        p_user_id: user.id,
      });
      throw new Error('Insufficient USDC in pool. Please try again later.');
    }

    // 온체인 전송 (Backend Smart Account에서 직접 USDC transfer)
    try {
      const recipientAddress = ethers.getAddress(toAddress);
      const feeRecipientAddress = ethers.getAddress(FEE_RECIPIENT_ADDRESS);
      
      const netTransferAmount = BigInt(Math.floor(netAmount * Math.pow(10, USDC_DECIMALS)));
      const feeTransferAmount = BigInt(Math.floor(feeAmount * Math.pow(10, USDC_DECIMALS)));
      
      logStep("Preparing direct USDC transfers", {
        userAmount: netAmount,
        feeAmount: feeAmount,
        userRecipient: recipientAddress,
        feeRecipient: feeRecipientAddress,
      });

      // USDC transfer 함수 호출 인코딩
      const usdcInterface = new ethers.Interface(USDC_ABI);
      const userTransferData = usdcInterface.encodeFunctionData("transfer", [recipientAddress, netTransferAmount]);
      const feeTransferData = usdcInterface.encodeFunctionData("transfer", [feeRecipientAddress, feeTransferAmount]);

      // executeBatch callData 생성 (USDC 컨트랙트에 2번 호출)
      const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
      const batchCallData = accountInterface.encodeFunctionData("executeBatch", [
        [USDC_ADDRESS, USDC_ADDRESS],           // dest[] - 둘 다 USDC 컨트랙트
        [userTransferData, feeTransferData],    // func[] - 각각 transfer 호출
      ]);

      // Nonce 가져오기
      const nonce = await accountContract.getNonce();
      logStep("Nonce fetched", { nonce: nonce.toString() });

      // 가스 가격 가져오기
      const feeData = await provider.getFeeData();
      const baseMaxPriorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("0.1", "gwei");
      const baseMaxFee = feeData.maxFeePerGas || ethers.parseUnits("0.5", "gwei");
      
      // 20% 버퍼 추가
      const maxPriorityFeePerGas = (baseMaxPriorityFee * 120n) / 100n;
      const maxFeePerGas = (baseMaxFee * 120n) / 100n;

      // UserOperation 생성
      const userOp: UserOperation = {
        sender: BACKEND_SMART_ACCOUNT,
        nonce: toRpcHex(nonce),
        initCode: "0x",
        callData: batchCallData,
        callGasLimit: toRpcHex(200000), // 2x USDC transfer
        verificationGasLimit: toRpcHex(100000),
        preVerificationGas: toRpcHex(50000),
        maxFeePerGas: toRpcHex(maxFeePerGas),
        maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
        paymasterAndData: "0x",
        signature: "0x",
      };

      // Paymaster sponsorship 요청
      logStep("Requesting paymaster sponsorship...");
      const paymasterResponse = await fetch(PAYMASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_getPaymasterData',
          params: [userOp, ENTRY_POINT, toRpcHex(chainId)],
        }),
      });

      const paymasterResult = await paymasterResponse.json();
      
      if (paymasterResult.error) {
        logStep("Paymaster error", paymasterResult.error);
        throw new Error(`Paymaster error: ${JSON.stringify(paymasterResult.error)}`);
      }

      userOp.paymasterAndData = paymasterResult.result.paymasterAndData;
      logStep("Paymaster data received");

      // UserOperation 서명
      const userOpHash = getUserOpHash(userOp, chainId);
      const signature = await operatorWallet.signMessage(ethers.getBytes(userOpHash));
      userOp.signature = signature;

      logStep("UserOperation signed, submitting to bundler...");

      // Bundler에 제출
      const sendResponse = await fetch(PAYMASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [userOp, ENTRY_POINT],
        }),
      });

      const sendResult = await sendResponse.json();

      if (sendResult.error) {
        logStep("Bundler error", sendResult.error);
        throw new Error(`Bundler error: ${JSON.stringify(sendResult.error)}`);
      }

      const userOpHashFromBundler = sendResult.result;
      logStep("UserOperation submitted", { userOpHash: userOpHashFromBundler });

      // Receipt 폴링
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        
        const receiptResponse = await fetch(PAYMASTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getUserOperationReceipt',
            params: [userOpHashFromBundler],
          }),
        });

        const receiptResult = await receiptResponse.json();
        
        if (receiptResult.result) {
          receipt = receiptResult.result;
          break;
        }
      }

      if (!receipt) {
        throw new Error('Transaction confirmation timeout');
      }

      const txHash = receipt.receipt?.transactionHash || receipt.transactionHash;
      const success = receipt.success === true || receipt.success === "0x1" || receipt.success === 1;

      if (!success) {
        throw new Error('Transaction failed on-chain');
      }

      logStep("Transaction confirmed", { txHash, success });

      // 트랜잭션 상태 업데이트
      await supabaseClient
        .from('usdc_transactions')
        .update({ 
          status: 'completed',
          tx_hash: txHash,
        })
        .eq('id', txRecordId);

      // 가스비 계산 (참고용)
      const gasUsed = BigInt(receipt.receipt?.gasUsed || receipt.actualGasUsed || "0");
      const effectiveGasPrice = BigInt(receipt.receipt?.effectiveGasPrice || maxFeePerGas);
      const gasCostWei = gasUsed * effectiveGasPrice;
      const gasCostEth = ethers.formatEther(gasCostWei);

      logStep("Gas cost (sponsored)", { 
        gasUsed: gasUsed.toString(), 
        gasCostEth,
        gasCostUSD: (parseFloat(gasCostEth) * 2500).toFixed(4) // ETH ~$2500 가정
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'USDC withdrawal successful',
          txHash,
          netAmount,
          fee: feeAmount,
          gasCostEth,
          source: 'backend_smart_account',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (onchainError: unknown) {
      // 온체인 전송 실패시 잔액 복구
      logStep("Onchain transfer failed, reverting...", onchainError);
      
      await supabaseClient.rpc('revert_usdc_withdrawal', {
        p_transaction_id: txRecordId,
        p_user_id: user.id,
      });

      throw onchainError;
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WITHDRAW-USDC] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
