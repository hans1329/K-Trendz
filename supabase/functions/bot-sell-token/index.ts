// deno.land 대신 Deno.serve 사용
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

// V3 ABI: sellFor(user, id, min, agent) — Operator가 유저 토큰 대리 매도
const botContractAbi = [
  "function sellFor(address user, uint256 id, uint256 min, address agent) external",
  "function sellRefund(uint256 id) external view returns (uint256 gross, uint256 fee, uint256 net)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)"
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

    const { token_id, artist_name, max_slippage_percent = 5, voucher_code } = await req.json();

    // Voucher 검증 (선택적)
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

    // 온체인 잔액 및 환불액 조회
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    const botPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    
    if (!rpcUrl || !botPrivateKey) {
      throw new Error("Missing environment variables: BASE_RPC_URL or BACKEND_WALLET_PRIVATE_KEY");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(botPrivateKey, provider);
    const contract = new ethers.Contract(BOT_CONTRACT_ADDRESS, botContractAbi, wallet);

    const finalTokenId = tokenData.token_id;
    const tokenIdBigInt = BigInt(finalTokenId);
    
    // V3: 유저 지갑의 토큰 잔액 확인
    const balance = await contract.balanceOf(userWallet, tokenIdBigInt);
    if (balance < 1n) {
      return new Response(
        JSON.stringify({ success: false, error: `No tokens to sell. User wallet ${userWallet} has 0 balance for this token.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 판매 환불액 계산 (V3: sellRefund — V2와 동일)
    const sellRefundResult = await contract.sellRefund(tokenIdBigInt);
    const netRefundUsdc = Number(sellRefundResult[2]) / 1e6;
    const feeUsdc = Number(sellRefundResult[1]) / 1e6;
    
    // 슬리피지 적용 (최소 환불액)
    const minRefund = sellRefundResult[2] * BigInt(100 - max_slippage_percent) / 100n;

    // pending 트랜잭션 기록
    const { data: txRecord, error: txError } = await supabase
      .from('bot_transactions')
      .insert({
        agent_id: agent.id,
        fanz_token_id: tokenData.id,
        transaction_type: 'sell',
        amount: 1,
        price_usdc: netRefundUsdc,
        fee_usdc: feeUsdc,
        total_cost_usdc: netRefundUsdc,
        status: 'pending'
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to record transaction: ${txError.message}`);
    }

    try {
      // V3: sellFor(user, id, min, agent) — Operator가 유저 토큰 대리 매도
      // user = userWallet (에이전트 지갑 = 토큰 보유자 & USDC 수령자)
      console.log(`V3 sellFor: user=${userWallet}, token=${finalTokenId}, minRefund=${minRefund}`);
      const sellData = contract.interface.encodeFunctionData('sellFor', [userWallet, tokenIdBigInt, minRefund, userWallet]);
      const sellTx = await wallet.sendTransaction({
        to: BOT_CONTRACT_ADDRESS,
        data: sellData + BUILDER_CODE_SUFFIX,
      });
      const receipt = await sellTx.wait();

      const wikiEntry = tokenData.wiki_entry as unknown as { title: string } | null;
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
          _amount_usd: netRefundUsdc,
          _gas_usd: 0.01
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: txRecord.id,
            tx_hash: receipt.hash,
            token_id: finalTokenId,
            artist_name: wikiEntry?.title || 'Unknown',
            amount: 1,
            net_refund_usdc: netRefundUsdc,
            fee_usdc: feeUsdc,
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
