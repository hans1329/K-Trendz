import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzChallenge 컨트랙트 ABI (selectWinners 함수)
const CHALLENGE_ABI = [
  "function selectWinners(uint256 challengeId, address[] calldata winnerAddresses) external",
  "function getWinners(uint256 challengeId) view returns (address[])",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId, onchainChallengeId, winnerAddresses } = await req.json();

    console.log('Selecting winners onchain:', { challengeId, onchainChallengeId, winnerCount: winnerAddresses?.length });

    // 환경 변수
    const contractAddress = Deno.env.get('CHALLENGE_CONTRACT_ADDRESS');
    const operatorPrivateKey = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!contractAddress) {
      throw new Error('CHALLENGE_CONTRACT_ADDRESS not configured');
    }
    if (!operatorPrivateKey) {
      throw new Error('BASE_OPERATOR_PRIVATE_KEY not configured');
    }
    if (!winnerAddresses || winnerAddresses.length === 0) {
      throw new Error('Winner addresses required');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Provider와 Wallet 설정
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const wallet = new ethers.Wallet(operatorPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, CHALLENGE_ABI, wallet);

    console.log('Operator wallet:', wallet.address);

    // onchainChallengeId가 없으면 DB에서 가져오기
    let finalOnchainId = onchainChallengeId;
    if (!finalOnchainId) {
      const { data: challenge } = await supabase
        .from('challenges')
        .select('options')
        .eq('id', challengeId)
        .single();
      
      const options = challenge?.options as any;
      finalOnchainId = options?.onchain_challenge_id;
      
      if (!finalOnchainId) {
        throw new Error('Onchain challenge ID not found. Create challenge onchain first.');
      }
    }

    // 유효한 이더리움 주소만 필터링
    const validAddresses = winnerAddresses.filter((addr: string) => 
      ethers.isAddress(addr)
    );

    if (validAddresses.length === 0) {
      throw new Error('No valid winner addresses provided');
    }

    console.log(`Selecting ${validAddresses.length} winners onchain...`);

    // 트랜잭션 전송
    const tx = await contract.selectWinners(
      BigInt(finalOnchainId),
      validAddresses
    );

    console.log('Transaction sent:', tx.hash);

    // 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.hash);

    // 온체인 당첨자 확인
    const onchainWinners = await contract.getWinners(BigInt(finalOnchainId));
    console.log('Onchain winners:', onchainWinners);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Winners selected onchain',
        data: {
          txHash: receipt.hash,
          onchainChallengeId: finalOnchainId,
          winnerCount: validAddresses.length,
          onchainWinners: onchainWinners,
          blockNumber: receipt.blockNumber,
          contractAddress,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error selecting winners onchain:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
