import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzChallenge 컨트랙트 ABI (createChallenge 함수)
const CHALLENGE_ABI = [
  "function createChallenge(bytes32 questionHash, bytes32 answerHash, uint256 prizePool, uint256 prizeWithLightstick, uint256 prizeWithoutLightstick, uint256 startTime, uint256 endTime, uint256 winnerCount) external",
  "function challengeCounter() view returns (uint256)",
  "function operator() view returns (address)",
  "function owner() view returns (address)",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      challengeId, // DB의 challenge UUID
      question,
      correctAnswer,
      prizePool,       // USDC (달러 단위, 예: 100 = $100)
      prizeWithLightstick,
      prizeWithoutLightstick,
      startTime,       // Unix timestamp
      endTime,         // Unix timestamp
      winnerCount,
    } = await req.json();

    console.log('=== CREATE CHALLENGE ONCHAIN ===');
    console.log('Input params:', { 
      challengeId, 
      question, 
      prizePool, 
      prizeWithLightstick, 
      prizeWithoutLightstick,
      startTime, 
      endTime, 
      winnerCount 
    });

    // 환경 변수
    const contractAddress = Deno.env.get('CHALLENGE_CONTRACT_ADDRESS');
    const operatorPrivateKey = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Contract address:', contractAddress);
    console.log('RPC URL:', baseRpcUrl);

    if (!contractAddress) {
      throw new Error('CHALLENGE_CONTRACT_ADDRESS not configured');
    }
    if (!operatorPrivateKey) {
      throw new Error('BASE_OPERATOR_PRIVATE_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Provider와 Wallet 설정
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);

    const network = await provider.getNetwork();
    console.log('Network:', { name: network.name, chainId: network.chainId.toString() });

    const contractCode = await provider.getCode(contractAddress);
    console.log('Contract code length:', contractCode.length);
    if (!contractCode || contractCode === '0x') {
      throw new Error('No contract code at CHALLENGE_CONTRACT_ADDRESS (wrong network/address)');
    }

    const wallet = new ethers.Wallet(operatorPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, CHALLENGE_ABI, wallet);

    console.log('Operator wallet:', wallet.address);

    // 컨트랙트 상태 확인
    try {
      const [currentOwner, currentOperator, counter] = await Promise.all([
        contract.owner(),
        contract.operator(),
        contract.challengeCounter(),
      ]);

      console.log('Contract owner:', currentOwner);
      console.log('Contract operator:', currentOperator);
      console.log('Wallet is operator:', currentOperator.toLowerCase() === wallet.address.toLowerCase());
      console.log('Contract challengeCounter:', counter.toString());
    } catch (e) {
      console.log('Could not fetch contract state:', e);
    }

    // 해시 생성
    const questionHash = ethers.keccak256(ethers.toUtf8Bytes(challengeId));
    const answerHash = ethers.keccak256(ethers.toUtf8Bytes(correctAnswer || 'pending'));

    console.log('questionHash:', questionHash);
    console.log('answerHash:', answerHash);

    // USDC는 6 decimals - 입력이 달러 단위이므로 6 decimals로 변환
    const prizePoolUsdc = ethers.parseUnits(String(prizePool), 6);
    const prizeWithLightstickUsdc = ethers.parseUnits(String(prizeWithLightstick), 6);
    const prizeWithoutLightstickUsdc = ethers.parseUnits(String(prizeWithoutLightstick), 6);

    console.log('USDC values (raw):', {
      prizePoolUsdc: prizePoolUsdc.toString(),
      prizeWithLightstickUsdc: prizeWithLightstickUsdc.toString(),
      prizeWithoutLightstickUsdc: prizeWithoutLightstickUsdc.toString(),
    });

    console.log('Time values:', { startTime, endTime, now: Math.floor(Date.now() / 1000) });
    console.log('startTime < endTime:', startTime < endTime);

    // staticCall로 먼저 시뮬레이션
    console.log('Simulating with staticCall...');

    const describeError = (e: unknown) => (e instanceof Error ? e.message : String(e));

    try {
      await contract.createChallenge.staticCall(
        questionHash,
        answerHash,
        prizePoolUsdc,
        prizeWithLightstickUsdc,
        prizeWithoutLightstickUsdc,
        startTime,
        endTime,
        winnerCount
      );
      console.log('staticCall succeeded - transaction should work');
    } catch (staticError: unknown) {
      const staticErrorMsg = describeError(staticError);
      console.error('staticCall failed:', staticErrorMsg);

      // 더 자세한 에러 정보 추출
      if (staticError && typeof staticError === 'object') {
        const err = staticError as Record<string, unknown>;
        if (err.reason) console.error('Revert reason:', err.reason);
        if (err.code) console.error('Error code:', err.code);
        if (err.data) console.error('Error data:', err.data);
      }

      // 진단: "startTime이 과거" 케이스 / "금액이 너무 큼" 케이스 등을 분리해서 체크
      const diagnostics: Record<string, string> = {};
      const now = Math.floor(Date.now() / 1000);

      if (typeof startTime === 'number' && startTime <= now) {
        const testStart = now + 60;
        const testEnd = testStart + 3600;
        try {
          await contract.createChallenge.staticCall(
            questionHash,
            answerHash,
            prizePoolUsdc,
            prizeWithLightstickUsdc,
            prizeWithoutLightstickUsdc,
            testStart,
            testEnd,
            winnerCount
          );
          diagnostics.startTimeFuture = 'PASS';
        } catch (e) {
          diagnostics.startTimeFuture = `FAIL: ${describeError(e)}`;
        }
      } else {
        diagnostics.startTimeFuture = 'SKIP';
      }

      try {
        await contract.createChallenge.staticCall(
          questionHash,
          answerHash,
          1_000_000n, // $1
          1_000_000n, // $1
          1n,         // $0.000001
          startTime,
          endTime,
          1
        );
        diagnostics.smallPrize = 'PASS';
      } catch (e) {
        diagnostics.smallPrize = `FAIL: ${describeError(e)}`;
      }

      console.error('Diagnostics:', diagnostics);

      throw new Error(
        `Contract simulation failed: ${staticErrorMsg}; diagnostics=${JSON.stringify(diagnostics)}`
      );
    }

    // 트랜잭션 전송
    console.log('Sending createChallenge transaction...');
    const tx = await contract.createChallenge(
      questionHash,
      answerHash,
      prizePoolUsdc,
      prizeWithLightstickUsdc,
      prizeWithoutLightstickUsdc,
      startTime,
      endTime,
      winnerCount
    );

    console.log('Transaction sent:', tx.hash);

    // 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.hash);

    // 온체인 챌린지 ID 가져오기
    const onchainChallengeId = await contract.challengeCounter();
    console.log('Onchain challenge ID:', onchainChallengeId.toString());

    // DB에서 기존 options 가져와서 업데이트
    const { data: existingChallenge } = await supabase
      .from('challenges')
      .select('options')
      .eq('id', challengeId)
      .single();

    const existingOptions = (existingChallenge?.options as Record<string, unknown>) || {};
    const updatedOptions = {
      ...existingOptions,
      onchain_challenge_id: onchainChallengeId.toString(),
      onchain_tx_hash: receipt.hash,
      onchain_created_at: new Date().toISOString(),
    };

    // onchain_challenge_id 컬럼과 options 둘 다 업데이트
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ 
        options: updatedOptions,
        onchain_challenge_id: Number(onchainChallengeId.toString())
      })
      .eq('id', challengeId);

    if (updateError) {
      console.error('Failed to update DB:', updateError);
    } else {
      console.log('DB updated with onchain_challenge_id:', onchainChallengeId.toString());
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Challenge created onchain',
        data: {
          txHash: receipt.hash,
          onchainChallengeId: onchainChallengeId.toString(),
          questionHash,
          answerHash,
          contractAddress,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('=== ERROR creating challenge onchain ===');
    console.error('Error message:', errorMessage);
    
    // 더 자세한 에러 로깅
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (err.code) console.error('Error code:', err.code);
      if (err.reason) console.error('Revert reason:', err.reason);
      if (err.transaction) console.error('Transaction:', JSON.stringify(err.transaction));
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
