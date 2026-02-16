// K-Trendz 챌린지 참여 온체인 일괄 기록 (배치 모드)
// - 챌린지 마감 후 당첨자 선정 시점에 모든 참여자를 한 번의 batchParticipate()로 기록
// - Backend Smart Account가 대행 실행 → 가스비 절감
// - 참여자 정보는 DB에서 조회하여 일괄 처리

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzChallenge 컨트랙트 ABI
const CHALLENGE_ABI = [
  "function batchParticipate(uint256 challengeId, address[] calldata participantAddresses, bytes32[] calldata answerHashes, bool[] calldata hasLightsticks) external",
  "function hasParticipated(uint256 challengeId, address participant) view returns (bool)",
];

// SimpleAccount execute ABI
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, bytes[] calldata func) external",
];

// KTrendzDAU ABI (DAU 기록용)
const DAU_CONTRACT_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
];

// DAU 활동 타입 해시
const ACTIVITY_CHALLENGE = ethers.keccak256(ethers.toUtf8Bytes("challenge"));

// ERC-4337 상수 (Base Mainnet)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// EntryPoint ABI (nonce 조회용)
const ENTRY_POINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
];

// Backend Smart Account (이미 배포됨)
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// 배치 사이즈 제한 (가스 한도 초과 방지 - 30명으로 축소)
const MAX_BATCH_SIZE = 30;

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

// Provider 생성 (Alchemy → Public RPC 자동 폴백)
async function createResilientProvider(baseRpcUrl: string) {
  const rpcUrls = [
    baseRpcUrl,
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean) as string[];

  for (const url of rpcUrls) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getNetwork();
      console.log('Using RPC:', url);
      return p;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('RPC failed, trying next:', url, msg.slice(0, 100));
    }
  }
  throw new Error('All RPC endpoints failed');
}

// UserOperation 생성 및 제출 헬퍼
async function submitUserOperation(
  executeCallData: string,
  operatorWallet: ethers.Wallet,
  provider: ethers.JsonRpcProvider,
  paymasterUrl: string,
  supabase: ReturnType<typeof createClient>,
) {
  const chainId = 8453n;

  // 온체인 실제 nonce 조회 (EntryPoint.getNonce)
  const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);
  const onchainNonce = await entryPoint.getNonce(BACKEND_SMART_ACCOUNT, 0n);
  console.log('On-chain nonce from EntryPoint:', onchainNonce.toString());

  // DB nonce 조회 (증가 없이 현재값만 확인)
  const { data: currentDbNonce } = await supabase
    .from('onchain_nonces')
    .select('current_nonce')
    .eq('sender_address', BACKEND_SMART_ACCOUNT)
    .single();

  const dbNonce = currentDbNonce ? BigInt(currentDbNonce.current_nonce) : 0n;
  console.log('DB nonce (before sync):', dbNonce.toString());

  // DB nonce가 온체인 nonce와 불일치하면 동기화
  // EntryPoint.getNonce()는 "다음에 사용할 논스"를 반환함
  // get_next_nonce RPC는 current_nonce를 +1 해서 반환하므로, DB에는 onchainNonce - 1을 저장해야
  // get_next_nonce가 올바른 onchainNonce 값을 반환함
  if (dbNonce !== onchainNonce - 1n) {
    const syncValue = Number(onchainNonce) - 1;
    console.log(`Nonce mismatch detected! DB=${dbNonce}, onchain expected=${onchainNonce}. Syncing DB to ${syncValue} (so get_next_nonce returns ${onchainNonce}).`);
    await supabase
      .from('onchain_nonces')
      .update({ current_nonce: syncValue })
      .eq('sender_address', BACKEND_SMART_ACCOUNT);
  }

  // DB에서 atomic nonce 가져오기 (동기화 후 증가)
  const { data: nonceData, error: nonceError } = await supabase
    .rpc('get_next_nonce', { p_sender_address: BACKEND_SMART_ACCOUNT });
  
  if (nonceError) {
    throw new Error(`Failed to get nonce from DB: ${nonceError.message}`);
  }
  
  const nonce = BigInt(nonceData);
  console.log('Final nonce for UserOp:', nonce.toString());

  // 동적 가스비 계산 (20% 버퍼)
  const feeData = await provider.getFeeData();
  const baseFee = feeData.maxFeePerGas || ethers.parseUnits('0.1', 'gwei');
  const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');
  const maxFeePerGas = (baseFee * 120n) / 100n;
  const maxPriorityFeePerGas = (priorityFee * 120n) / 100n;

  // UserOperation 구성
  const userOp: UserOperation = {
    sender: BACKEND_SMART_ACCOUNT,
    nonce,
    initCode: '0x',
    callData: executeCallData + BUILDER_CODE_SUFFIX,
    callGasLimit: 800000n, // 30명 배치 처리를 위한 충분한 가스 (storage write × 30)
    verificationGasLimit: 200000n,
    preVerificationGas: 100000n,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: '0x',
    signature: '0x',
  };

  // Paymaster 요청
  console.log('Requesting Paymaster sponsorship...');
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
  if (paymasterResult.error) {
    throw new Error(`Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}`);
  }

  // Paymaster 데이터 적용
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

  // ERC-191 서명
  const userOpHash = getUserOpHash(userOp, chainId);
  const signature = await operatorWallet.signMessage(ethers.getBytes(userOpHash));
  userOp.signature = signature;

  // Bundler에 제출
  console.log('Submitting UserOperation to Bundler...');
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
  if (bundlerResult.error) {
    throw new Error(`Bundler error: ${bundlerResult.error.message || JSON.stringify(bundlerResult.error)}`);
  }

  const userOpHashResult = bundlerResult.result;
  console.log('UserOperation hash:', userOpHashResult);

  // 영수증 대기 (최대 15초 - Base는 2초 블록타임이므로 충분)
  let receipt = null;
  for (let i = 0; i < 15; i++) {
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

  // receipt가 없어도 userOpHash를 fallback으로 반환 (mempool에 있을 수 있음)
  // 이렇게 하면 DB에 userOpHash가 저장되어 재시도 시 중복 제출 방지
  const finalTxHash = receipt?.receipt?.transactionHash || null;
  
  return {
    userOpHash: userOpHashResult,
    txHash: finalTxHash,
    // receipt 없이 userOpHash만 있는 경우도 "제출됨"으로 처리
    pendingHash: !finalTxHash ? userOpHashResult : null,
    receipt,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId } = await req.json();
    
    console.log('=== Batch recording challenge participations onchain ===');
    console.log('Challenge ID:', challengeId);

    // 환경 변수 확인
    const contractAddress = Deno.env.get('CHALLENGE_CONTRACT_ADDRESS');
    const operatorPrivateKey = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const paymasterUrl = Deno.env.get('COINBASE_PAYMASTER_URL');
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!contractAddress) throw new Error('CHALLENGE_CONTRACT_ADDRESS not configured');
    if (!operatorPrivateKey) throw new Error('BASE_OPERATOR_PRIVATE_KEY not configured');
    if (!paymasterUrl) throw new Error('COINBASE_PAYMASTER_URL not configured');
    if (!baseRpcUrl) throw new Error('BASE_RPC_URL not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 챌린지 온체인 ID 가져오기
    const { data: challengeData, error: challengeError } = await supabase
      .from('challenges')
      .select('onchain_challenge_id, options')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challengeData) {
      throw new Error('Challenge not found');
    }

    const options = challengeData.options as Record<string, unknown> | null;
    const onchainChallengeId = challengeData.onchain_challenge_id ?? options?.onchain_challenge_id;
    
    // 0도 유효한 온체인 ID이므로 null/undefined만 체크 (falsy 체크 금지)
    if (onchainChallengeId === null || onchainChallengeId === undefined) {
      throw new Error('Challenge not yet created onchain (missing onchain_challenge_id)');
    }
    
    console.log('Onchain challenge ID:', onchainChallengeId);

    // 2. 모든 참여자 목록 가져오기 (tx_hash가 없는 것만 = 아직 온체인 미기록)
    const { data: participations, error: partError } = await supabase
      .from('challenge_participations')
      .select('id, user_id, answer, has_lightstick, created_at')
      .eq('challenge_id', challengeId)
      .is('tx_hash', null)
      .order('created_at', { ascending: true });

    if (partError) {
      throw new Error(`Failed to fetch participations: ${partError.message}`);
    }

    if (!participations || participations.length === 0) {
      console.log('No unrecorded participations found');
      return new Response(
        JSON.stringify({ success: true, message: 'No participations to record', recorded: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${participations.length} unrecorded participations`);

    // 3. 각 참여자의 Smart Wallet 주소 가져오기
    const userIds = participations.map(p => p.user_id);
    const { data: wallets, error: walletError } = await supabase
      .from('wallet_addresses')
      .select('user_id, wallet_address')
      .in('user_id', userIds)
      .eq('wallet_type', 'smart_wallet');

    if (walletError) {
      throw new Error(`Failed to fetch wallets: ${walletError.message}`);
    }

    const walletMap = new Map((wallets || []).map(w => [w.user_id, w.wallet_address]));
    
    // 지갑이 있는 참여자만 필터링 + user_id별 중복 제거 (첫 번째 참여만 유지)
    // 한 사용자가 최대 3회 참여 가능하지만 온체인에는 주소당 1건만 기록됨
    const seenUserIds = new Set<string>();
    const recordable = participations.filter(p => {
      if (!walletMap.has(p.user_id)) return false;
      if (seenUserIds.has(p.user_id)) return false;
      seenUserIds.add(p.user_id);
      return true;
    });
    const skipped = participations.length - recordable.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} entries (no wallet or duplicate user)`);
    }

    if (recordable.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No participants with wallets to record', recorded: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4-1. 온체인 중복 체크 (재시도 시 이미 기록된 참여자 제외)
    // hasParticipated()로 이미 온체인에 기록된 주소를 필터링하여 컨트랙트 revert 방지
    // RPC rate limit 방지를 위해 10개씩 청크 처리
    const provider = await createResilientProvider(baseRpcUrl);
    const challengeContract = new ethers.Contract(contractAddress, CHALLENGE_ABI, provider);
    
    const RPC_CHUNK_SIZE = 10;
    const onchainResults: { participation: typeof recordable[0]; alreadyOnchain: boolean }[] = [];
    
    for (let i = 0; i < recordable.length; i += RPC_CHUNK_SIZE) {
      const chunk = recordable.slice(i, i + RPC_CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (p) => {
          const walletAddress = walletMap.get(p.user_id)!;
          try {
            const already = await challengeContract.hasParticipated(
              BigInt(onchainChallengeId as string),
              walletAddress
            );
            return { participation: p, alreadyOnchain: already as boolean };
          } catch {
            // RPC 에러 시 안전하게 포함 (컨트랙트에서 자체 중복 방지)
            return { participation: p, alreadyOnchain: false };
          }
        })
      );
      onchainResults.push(...chunkResults);
    }
    
    console.log(`Onchain check complete: ${onchainResults.length} participants verified`);
    const alreadyRecordedCount = onchainResults.filter(r => r.alreadyOnchain).length;
    const filteredRecordable = onchainResults
      .filter(r => !r.alreadyOnchain)
      .map(r => r.participation);

    if (alreadyRecordedCount > 0) {
      console.log(`Skipping ${alreadyRecordedCount} participants already recorded onchain`);
      
      // 이미 온체인에 있는 참여자의 DB tx_hash도 업데이트 (orphaned records 정리)
      const alreadyRecordedUserIds = onchainResults
        .filter(r => r.alreadyOnchain)
        .map(r => r.participation.user_id);
      
      if (alreadyRecordedUserIds.length > 0) {
        await supabase
          .from('challenge_participations')
          .update({ tx_hash: 'already_onchain' })
          .eq('challenge_id', challengeId)
          .in('user_id', alreadyRecordedUserIds)
          .is('tx_hash', null);
      }
    }

    if (filteredRecordable.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'All participants already recorded onchain', recorded: 0, alreadyOnchain: alreadyRecordedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Operator 설정 (Provider는 위에서 이미 생성됨)
    const operatorWallet = new ethers.Wallet(operatorPrivateKey);
    console.log('Operator wallet:', operatorWallet.address);

    // 6. 배치 분할 처리
    const batches: typeof filteredRecordable[] = [];
    for (let i = 0; i < filteredRecordable.length; i += MAX_BATCH_SIZE) {
      batches.push(filteredRecordable.slice(i, i + MAX_BATCH_SIZE));
    }
    console.log(`Split into ${batches.length} batch(es) of max ${MAX_BATCH_SIZE}`);

    const challengeInterface = new ethers.Interface(CHALLENGE_ABI);
    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS");
    const dauInterface = dauContractAddress ? new ethers.Interface(DAU_CONTRACT_ABI) : null;

    const results: { batchIndex: number; txHash: string | null; pendingHash: string | null; count: number }[] = [];

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} participants)`);

      // batchParticipate callData 생성
      const addresses: string[] = [];
      const answerHashes: string[] = [];
      const lightsticks: boolean[] = [];

      for (const p of batch) {
        const walletAddress = walletMap.get(p.user_id)!;
        const answerHash = ethers.keccak256(
          ethers.solidityPacked(['string', 'string'], [challengeId, p.answer])
        );
        addresses.push(walletAddress);
        answerHashes.push(answerHash);
        lightsticks.push(p.has_lightstick || false);
      }

      const batchParticipateCallData = challengeInterface.encodeFunctionData('batchParticipate', [
        BigInt(onchainChallengeId as string),
        addresses,
        answerHashes,
        lightsticks,
      ]);

      // execute callData 생성 (DAU 포함 여부에 따라)
      let executeCallData: string;

      if (dauContractAddress && dauInterface) {
        // DAU 기록: 첫 번째 참여자 대표로 1건만 기록
        const challengeHash = ethers.keccak256(
          ethers.solidityPacked(['string'], [challengeId])
        );
        const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
          addresses[0],
          ACTIVITY_CHALLENGE,
          challengeHash,
        ]);
        executeCallData = accountInterface.encodeFunctionData("executeBatch", [
          [contractAddress, dauContractAddress],
          [batchParticipateCallData, dauCalldata],
        ]);
      } else {
        executeCallData = accountInterface.encodeFunctionData("execute", [
          contractAddress,
          0n,
          batchParticipateCallData,
        ]);
      }

      // UserOperation 제출
      try {
        const result = await submitUserOperation(
          executeCallData,
          operatorWallet,
          provider,
          paymasterUrl,
          supabase,
        );

        console.log(`Batch ${batchIdx + 1} result: txHash=${result.txHash}, pendingHash=${result.pendingHash}`);
        results.push({ batchIndex: batchIdx, txHash: result.txHash, pendingHash: result.pendingHash, count: batch.length });

        // DB에 tx_hash 업데이트 (중복 제거된 유저의 다른 참여 레코드도 포함)
        // txHash가 있으면 최종 해시, 없으면 pendingHash(userOpHash)를 fallback으로 저장
        const hashToSave = result.txHash || result.pendingHash;
        if (hashToSave) {
          const batchUserIds = batch.map(p => p.user_id);
          const { error: updateError } = await supabase
            .from('challenge_participations')
            .update({ tx_hash: hashToSave })
            .eq('challenge_id', challengeId)
            .in('user_id', batchUserIds);
          
          if (updateError) {
            console.error(`Failed to update tx_hash for batch ${batchIdx + 1}:`, updateError);
          } else {
            const hashType = result.txHash ? 'confirmed' : 'pending(userOpHash)';
            console.log(`Updated tx_hash (${hashType}) for ${batchUserIds.length} users' participations`);
          }
        }
      } catch (batchError: unknown) {
        const msg = batchError instanceof Error ? batchError.message : String(batchError);
        console.error(`Batch ${batchIdx + 1} failed:`, msg);
        results.push({ batchIndex: batchIdx, txHash: null, pendingHash: null, count: batch.length });
        // Paymaster/Bundler 실패 시 nonce가 DB에서만 소진되고 온체인 미제출 →
        // 후속 배치도 nonce 불일치로 연쇄 실패하므로 즉시 중단
        console.log('Stopping batch processing: nonce may be out of sync after submission failure');
        break;
      }
    }

    // 확인된 배치 + pending 배치를 구분하여 정확한 리포팅
    const totalConfirmed = results.filter(r => r.txHash).reduce((sum, r) => sum + r.count, 0);
    const totalPending = results.filter(r => !r.txHash && r.pendingHash).reduce((sum, r) => sum + r.count, 0);
    const totalFailed = results.filter(r => !r.txHash && !r.pendingHash).reduce((sum, r) => sum + r.count, 0);
    const totalRecorded = totalConfirmed + totalPending; // 제출된 것은 모두 "recorded"로 처리

    console.log(`=== Batch recording complete: ${totalConfirmed} confirmed, ${totalPending} pending, ${totalFailed} failed ===`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Batch recorded ${totalRecorded} participations onchain (${totalConfirmed} confirmed, ${totalPending} pending)`,
        data: {
          challengeId,
          onchainChallengeId,
          totalParticipants: filteredRecordable.length,
          totalRecorded,
          totalConfirmed,
          totalPending,
          totalFailed,
          totalSkipped: skipped,
          alreadyOnchain: alreadyRecordedCount,
          batches: results,
          contractAddress,
          backendSmartAccount: BACKEND_SMART_ACCOUNT,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error batch recording challenge onchain:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
