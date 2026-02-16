import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USDC_DECIMALS = 6;

const logStep = (step: string, details?: any) => {
  console.log(`[RECALCULATE-FEES] ${step}`, details || '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting fee recalculation (USDC)");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Admin 권한 확인
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // admin 역할 확인
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        throw new Error('Admin access required');
      }
    }

    // 컨트랙트 설정 (FanzTokenUSDC) - Alchemy RPC 우선 사용
    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    const rpcUrl = alchemyKey 
      ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : (Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org");
    
    if (!contractAddress) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS not configured");
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const fanzTokenAbi = [
      "function calculateBuyCost(uint256 tokenId, uint256 amount) external view returns (uint256 totalCost, uint256 creatorFee, uint256 platformFee)"
    ];
    const contract = new ethers.Contract(contractAddress, fanzTokenAbi, provider);

    // 모든 buy 트랜잭션 조회
    const { data: transactions, error: txError } = await supabaseClient
      .from('fanz_transactions')
      .select(`
        id,
        fanz_token_id,
        creator_fee,
        platform_fee,
        payment_value
      `)
      .eq('transaction_type', 'buy');

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    logStep("Transactions found", { count: transactions?.length });

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    for (const tx of transactions || []) {
      try {
        // fanz_token 정보 조회
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('fanz_tokens')
          .select('token_id')
          .eq('id', tx.fanz_token_id)
          .single();

        if (tokenError || !tokenData?.token_id) {
          logStep("Token not found, skipping", { txId: tx.id, fanzTokenId: tx.fanz_token_id });
          skipped++;
          continue;
        }

        // 온체인에서 수수료 계산 (USDC 단위)
        // issue-fanz-token에서 UUID 앞 16자리를 hex로 변환하여 생성했으므로 직접 BigInt 변환
        const tokenIdUint = BigInt(tokenData.token_id);
        
        let creatorFeeUsd = 0;
        let platformFeeUsd = 0;

        try {
          const [totalCost, creatorFee, platformFee] = await contract.calculateBuyCost(tokenIdUint, 1);
          
          // USDC 단위를 USD로 변환 (6 decimals)
          creatorFeeUsd = Number(creatorFee) / (10 ** USDC_DECIMALS);
          platformFeeUsd = Number(platformFee) / (10 ** USDC_DECIMALS);

          logStep("On-chain fees calculated (USDC)", {
            txId: tx.id,
            oldCreatorFee: tx.creator_fee,
            newCreatorFee: creatorFeeUsd.toFixed(4),
            oldPlatformFee: tx.platform_fee,
            newPlatformFee: platformFeeUsd.toFixed(4)
          });

        } catch (contractError: any) {
          logStep("Contract call failed, skipping", { 
            txId: tx.id, 
            error: contractError.message 
          });
          skipped++;
          continue;
        }

        // DB 업데이트
        const { error: updateError } = await supabaseClient
          .from('fanz_transactions')
          .update({
            creator_fee: creatorFeeUsd,
            platform_fee: platformFeeUsd
          })
          .eq('id', tx.id);

        if (updateError) {
          logStep("Update failed", { txId: tx.id, error: updateError.message });
          errors++;
        } else {
          updated++;
          results.push({
            txId: tx.id,
            oldCreatorFee: tx.creator_fee,
            newCreatorFee: creatorFeeUsd,
            oldPlatformFee: tx.platform_fee,
            newPlatformFee: platformFeeUsd
          });
        }

      } catch (innerError: any) {
        logStep("Error processing transaction", { txId: tx.id, error: innerError.message });
        errors++;
      }
    }

    logStep("Recalculation complete", { updated, skipped, errors });

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        errors,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
