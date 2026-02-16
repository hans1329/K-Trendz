import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External wallet users (Frame 참여자)에게 직접 USDC 전송
// Backend Smart Account를 통해 Paymaster 후원 가스로 실행

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAU_CONTRACT_ADDRESS = "0xf7F05cEd0F2c905aD59C370265D67846FAb9959E";
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const BASE_RPC_URL = "https://mainnet.base.org";

// ABIs
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
    const { challengeId, winners } = await req.json();
    
    console.log('Distributing prizes to external wallets:', { 
      challengeId, 
      winnerCount: winners?.length 
    });

    if (!challengeId) {
      throw new Error('Challenge ID required');
    }

    if (!winners || winners.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No external winners to distribute to',
          data: { successCount: 0, failedCount: 0, totalDistributed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const paymasterUrl = Deno.env.get('COINBASE_PAYMASTER_URL');
    const privateKey = Deno.env.get('BACKEND_WALLET_PRIVATE_KEY');
    const rpcUrl = Deno.env.get('BASE_MAINNET_RPC') || BASE_RPC_URL;

    if (!paymasterUrl || !privateKey) {
      throw new Error('Missing COINBASE_PAYMASTER_URL or BACKEND_WALLET_PRIVATE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const ownerWallet = new ethers.Wallet(privateKey, provider);

    // 챌린지 정보 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, question, status')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error('Challenge not found');
    }

    // USDC contract
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const dauContract = new ethers.Contract(DAU_CONTRACT_ADDRESS, DAU_ABI, provider);
    const smartAccountContract = new ethers.Contract(BACKEND_SMART_ACCOUNT, SIMPLE_ACCOUNT_ABI, provider);

    // Backend Smart Account USDC 잔액 확인
    const poolBalance = await usdcContract.balanceOf(BACKEND_SMART_ACCOUNT);
    const totalNeeded = winners.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
    const totalNeededWei = BigInt(Math.round(totalNeeded * 1e6));

    console.log(`Pool balance: ${ethers.formatUnits(poolBalance, 6)} USDC, needed: ${totalNeeded} USDC`);

    if (poolBalance < totalNeededWei) {
      throw new Error(`Insufficient pool balance. Have: ${ethers.formatUnits(poolBalance, 6)}, Need: ${totalNeeded}`);
    }

    let successCount = 0;
    let failedCount = 0;
    const failedWinners: string[] = [];
    let totalDistributed = 0;
    const txHashes: string[] = [];

    // 배치로 모든 전송 처리 (단일 트랜잭션으로)
    const destinations: string[] = [];
    const callDatas: string[] = [];
    const processedWinners: { externalWalletId: string; amount: number; walletAddress: string }[] = [];

    // Activity type hash for DAU
    const PRIZE_CLAIM_HASH = ethers.keccak256(ethers.toUtf8Bytes("PRIZE_CLAIM"));
    const challengeIdHash = ethers.keccak256(ethers.toUtf8Bytes(challengeId));

    for (const winner of winners) {
      const { externalWalletId, amount, walletAddress } = winner;
      
      if (!externalWalletId || !amount || amount <= 0 || !walletAddress) {
        console.warn('Invalid winner data:', winner);
        failedCount++;
        failedWinners.push(externalWalletId || 'unknown');
        continue;
      }

      if (!ethers.isAddress(walletAddress)) {
        console.warn(`Invalid wallet address: ${walletAddress}`);
        failedCount++;
        failedWinners.push(externalWalletId);
        continue;
      }

      // 참여 정보 확인
      const { data: participation, error: partError } = await supabase
        .from('external_challenge_participations')
        .select('is_winner, claimed_at, prize_amount')
        .eq('challenge_id', challengeId)
        .eq('external_wallet_id', externalWalletId)
        .single();

      if (partError || !participation) {
        console.warn(`Participation not found for external wallet ${externalWalletId}`);
        failedCount++;
        failedWinners.push(externalWalletId);
        continue;
      }

      if (!participation.is_winner) {
        console.warn(`External wallet ${externalWalletId} is not a winner`);
        failedCount++;
        failedWinners.push(externalWalletId);
        continue;
      }

      if (participation.claimed_at) {
        console.warn(`External wallet ${externalWalletId} already claimed`);
        failedCount++;
        failedWinners.push(externalWalletId);
        continue;
      }

      // USDC transfer call data
      const amountWei = BigInt(Math.round(amount * 1e6));
      const transferData = usdcContract.interface.encodeFunctionData('transfer', [walletAddress, amountWei]);
      destinations.push(USDC_ADDRESS);
      callDatas.push(transferData);

      // DAU record call data
      const dauData = dauContract.interface.encodeFunctionData('recordActivity', [walletAddress, PRIZE_CLAIM_HASH, challengeIdHash]);
      destinations.push(DAU_CONTRACT_ADDRESS);
      callDatas.push(dauData);

      processedWinners.push({ externalWalletId, amount, walletAddress });
      totalDistributed += amount;
    }

    if (processedWinners.length === 0) {
      console.log('No valid winners to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No valid external winners to distribute to',
          data: { successCount: 0, failedCount, failedWinners, totalDistributed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Preparing batch transfer for ${processedWinners.length} winners, total: ${totalDistributed} USDC`);

    // Build executeBatch call
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
      callGasLimit: toRpcHex(500000n + BigInt(processedWinners.length) * 100000n), // Scale with winner count
      verificationGasLimit: toRpcHex(150000n),
      preVerificationGas: toRpcHex(60000n),
      maxFeePerGas: toRpcHex(maxFeePerGas),
      maxPriorityFeePerGas: toRpcHex(maxPriorityFeePerGas),
      paymasterAndData: '0x',
      signature: '0x',
    };

    // Request Paymaster sponsorship
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

    // Sign UserOperation
    const userOpHash = getUserOpHash(userOp, 8453n);
    const signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    // Submit to Bundler
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

    // Poll for receipt
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

    // Check success
    const success = receipt.success === true || receipt.success === '0x1' || receipt.success === 1;
    if (!success) {
      throw new Error('Transaction reverted on-chain');
    }

    txHashes.push(txHash);

    // Update all processed winners in DB
    for (const winner of processedWinners) {
      const { error: updateError } = await supabase
        .from('external_challenge_participations')
        .update({ 
          claimed_at: new Date().toISOString(),
          prize_tx_hash: txHash,
        })
        .eq('challenge_id', challengeId)
        .eq('external_wallet_id', winner.externalWalletId);

      if (updateError) {
        console.error(`Failed to update participation for ${winner.externalWalletId}:`, updateError);
      } else {
        successCount++;
      }
    }

    console.log('External distribution completed:', {
      successCount,
      failedCount,
      totalDistributed,
      txHash,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Prizes distributed to ${successCount} external winners`,
        data: {
          successCount,
          failedCount,
          failedWinners: failedWinners.length > 0 ? failedWinners : undefined,
          totalDistributed,
          txHash,
          challengeId,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error distributing external prizes:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
