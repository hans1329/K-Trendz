import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ethers } from "npm:ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-api-key',
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// FanzTokenBot V3 컨트랙트 (User-Funded Delegated Trading)
const BOT_CONTRACT_ADDRESS = "0xBBf57b07847E355667D4f8583016dD395c5cB1D1";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// V3 ABI: buyFor(user, id, max, agent) — Operator가 유저 자금으로 대리 구매
const botContractAbi = [
  "function buyFor(address user, uint256 id, uint256 max, address agent) external",
  "function buyCost(uint256 id) external view returns (uint256 res, uint256 art, uint256 plat, uint256 total)",
  "function price(uint256 id) external view returns (uint256)"
];

const usdcAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API Key 인증
    const apiKey = req.headers.get('x-bot-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API key required. Get your API key at https://k-trendz.com/bot-trading — connect your wallet, approve USDC, and register your agent in 1 minute.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // API Key 검증 및 에이전트 정보 조회
    const { data: agents, error: agentError } = await supabase
      .rpc('get_bot_agent_by_api_key', { api_key_param: apiKey });

    if (agentError || !agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key. It may have been re-issued. Go to https://k-trendz.com/bot-trading to get your current key.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agent = agents[0];

    // V3: 에이전트에 wallet_address 필수
    if (!agent.wallet_address || !ethers.isAddress(agent.wallet_address)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No wallet linked to this agent. Go to https://k-trendz.com/bot-trading → Setup tab to connect your wallet and re-register.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userWallet = agent.wallet_address;

    // 일일 한도 확인
    if (agent.daily_usage >= agent.daily_limit_usd) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Daily limit exceeded. Used: $${agent.daily_usage}/${agent.daily_limit_usd}` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token_id, artist_name, max_slippage_percent = 5, voucher_code } = await req.json();

    // Voucher 검증 (선택적 - 있으면 가스비 스폰서링)
    let voucherId: string | null = null;
    if (voucher_code) {
      const { data: voucherCheck, error: voucherError } = await supabase
        .rpc('check_voucher_daily_limit', { 
          _voucher_code: voucher_code, 
          _amount_usd: 0
        });

      if (voucherError) {
        console.error("Voucher check error:", voucherError);
      } else if (!voucherCheck?.success) {
        console.log("Voucher validation failed:", voucherCheck?.error);
      } else {
        voucherId = voucherCheck.voucher_id;
        console.log("Voucher validated, gas sponsoring enabled");
      }
    }

    if (!token_id && !artist_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'token_id or artist_name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DB에서 Bot Contract 등록 토큰 정보 확인
    let resolvedTokenId = token_id;

    if (!token_id && artist_name) {
      // 아티스트 이름으로 wiki_entry 검색 (정확한 매칭 우선)
      let wikiEntry = null;
      
      const { data: exactMatch } = await supabase
        .from('wiki_entries')
        .select('id')
        .eq('title', artist_name)
        .limit(1)
        .single();
      
      if (exactMatch) {
        wikiEntry = exactMatch;
      } else {
        const { data: partialMatch } = await supabase
          .from('wiki_entries')
          .select('id')
          .ilike('title', `%${artist_name}%`)
          .limit(1)
          .single();
        
        if (partialMatch) {
          wikiEntry = partialMatch;
        }
      }
      
      if (!wikiEntry) {
        return new Response(
          JSON.stringify({ success: false, error: `Artist "${artist_name}" not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: fanzToken, error: fanzError } = await supabase
        .from('fanz_tokens')
        .select('token_id')
        .eq('wiki_entry_id', wikiEntry.id)
        .eq('is_active', true)
        .eq('bot_contract_registered', true)
        .limit(1)
        .single();

      if (fanzError || !fanzToken) {
        return new Response(
          JSON.stringify({ success: false, error: `No bot-tradeable token found for artist "${artist_name}"` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      resolvedTokenId = fanzToken.token_id;
    }

    // token_id로 Bot Contract 등록 토큰 정보 조회
    const { data: tokenData, error: tokenError } = await supabase
      .from('fanz_tokens')
      .select('id, token_id, wiki_entry:wiki_entries!fanz_tokens_wiki_entry_id_fkey(title)')
      .eq('is_active', true)
      .eq('bot_contract_registered', true)
      .eq('token_id', resolvedTokenId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token not registered on Bot Contract' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 온체인 가격 조회
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    const botPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    
    if (!rpcUrl || !botPrivateKey) {
      throw new Error("Missing environment variables: BASE_RPC_URL or BACKEND_WALLET_PRIVATE_KEY");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(botPrivateKey, provider);
    const contract = new ethers.Contract(BOT_CONTRACT_ADDRESS, botContractAbi, wallet);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

    const finalTokenId = tokenData.token_id;
    const tokenIdBigInt = BigInt(finalTokenId);
    
    // 구매 비용 계산 (V3: buyCost — V2와 동일)
    const buyCostResult = await contract.buyCost(tokenIdBigInt);
    const totalCostUsdc = Number(buyCostResult[3]) / 1e6;
    
    // 슬리피지 적용
    const maxCost = buyCostResult[3] * BigInt(100 + max_slippage_percent) / 100n;

    // 일일 한도 재확인 (비용 포함)
    if (agent.daily_usage + totalCostUsdc > agent.daily_limit_usd) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Would exceed daily limit. Cost: $${totalCostUsdc.toFixed(2)}, Remaining: $${(agent.daily_limit_usd - agent.daily_usage).toFixed(2)}` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // pending 트랜잭션 기록
    const { data: txRecord, error: txError } = await supabase
      .from('bot_transactions')
      .insert({
        agent_id: agent.id,
        fanz_token_id: tokenData.id,
        transaction_type: 'buy',
        amount: 1,
        price_usdc: Number(buyCostResult[0]) / 1e6,
        fee_usdc: (Number(buyCostResult[1]) + Number(buyCostResult[2])) / 1e6,
        total_cost_usdc: totalCostUsdc,
        status: 'pending'
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to record transaction: ${txError.message}`);
    }

    try {
      // V3: 유저 지갑의 USDC allowance 확인 (유저가 사전에 approve 해야 함)
      const userAllowance = await usdcContract.allowance(userWallet, BOT_CONTRACT_ADDRESS);
      if (userAllowance < maxCost) {
        const needed = (Number(maxCost) / 1e6).toFixed(2);
        const current = (Number(userAllowance) / 1e6).toFixed(2);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient USDC allowance. Needed: $${needed}, Current: $${current}. Go to https://k-trendz.com/bot-trading → Setup tab → Step 2 to approve more USDC.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // V3: buyFor(user, id, max, agent) — Operator가 유저 USDC로 대리 구매
      // user = userWallet (에이전트의 지갑 = USDC 보유자 & 토큰 수령자)
      // agent = 에이전트 지갑 (DAU 추적용)
      console.log(`V3 buyFor: user=${userWallet}, token=${finalTokenId}, maxCost=${maxCost}`);
      const buyData = contract.interface.encodeFunctionData('buyFor', [userWallet, tokenIdBigInt, maxCost, userWallet]);
      const buyTx = await wallet.sendTransaction({
        to: BOT_CONTRACT_ADDRESS,
        data: buyData + BUILDER_CODE_SUFFIX,
      });
      const receipt = await buyTx.wait();

      // 트랜잭션 성공 업데이트
      await supabase
        .from('bot_transactions')
        .update({
          status: 'completed',
          tx_hash: receipt.hash
        })
        .eq('id', txRecord.id);

      // Voucher 사용량 기록
      if (voucherId) {
        await supabase.rpc('increment_voucher_usage', {
          _voucher_id: voucherId,
          _amount_usd: totalCostUsdc,
          _gas_usd: 0.01
        });
      }

      const wikiEntry = tokenData.wiki_entry as unknown as { title: string } | null;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: txRecord.id,
            tx_hash: receipt.hash,
            token_id: finalTokenId,
            artist_name: wikiEntry?.title || 'Unknown',
            amount: 1,
            total_cost_usdc: totalCostUsdc,
            remaining_daily_limit: agent.daily_limit_usd - agent.daily_usage - totalCostUsdc,
            gas_sponsored: !!voucherId,
            contract_version: 'V3'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (txErr) {
      const errorMessage = txErr instanceof Error ? txErr.message : String(txErr);
      await supabase
        .from('bot_transactions')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', txRecord.id);

      throw txErr;
    }
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
