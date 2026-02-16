// deno.land 대신 Deno.serve 사용
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-api-key',
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// FanzTokenBot V3 컨트랙트 (User-Funded Delegated Trading)
const BOT_CONTRACT_ADDRESS = "0xBBf57b07847E355667D4f8583016dD395c5cB1D1";

const botContractAbi = [
  "function price(uint256 id) external view returns (uint256)",
  "function info(uint256 id) external view returns (uint256 supply, uint256 base, uint256 k, address creator, bool exists)",
  "function buyCost(uint256 id) external view returns (uint256 res, uint256 art, uint256 plat, uint256 total)",
  "function sellRefund(uint256 id) external view returns (uint256 gross, uint256 fee, uint256 net)"
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 시세 조회는 공개 API — 인증 불필요
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { token_id, artist_name } = await req.json();

    if (!token_id && !artist_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'token_id or artist_name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DB에서 토큰 정보 조회
    let query = supabase
      .from('fanz_tokens')
      .select(`
        id,
        token_id,
        total_supply,
        base_price,
        k_value,
        wiki_entry:wiki_entries!fanz_tokens_wiki_entry_id_fkey (
          id,
          title,
          trending_score,
          votes,
          follower_count,
          view_count
        )
      `)
      .eq('is_active', true);

    let resolvedTokenId = token_id;

    if (!token_id && artist_name) {
      // 아티스트 이름으로 wiki_entry 검색 (정확한 매칭 우선)
      let wikiEntry = null;
      
      // 1. 정확한 매칭 시도
      const { data: exactMatch } = await supabase
        .from('wiki_entries')
        .select('id')
        .eq('title', artist_name)
        .limit(1)
        .single();
      
      if (exactMatch) {
        wikiEntry = exactMatch;
      } else {
        // 2. 부분 매칭 시도
        const { data: partialMatch, error: partialError } = await supabase
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

      // wiki_entry_id로 Bot Contract 등록 토큰 조회
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
          JSON.stringify({ success: false, error: `No active token found for artist "${artist_name}"` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      resolvedTokenId = fanzToken.token_id;
    }

    // token_id로 Bot Contract 등록 토큰 정보 조회
    const { data: tokenData, error: tokenError } = await supabase
      .from('fanz_tokens')
      .select(`
        id,
        token_id,
        total_supply,
        base_price,
        k_value,
        wiki_entry:wiki_entries!fanz_tokens_wiki_entry_id_fkey (
          id,
          title,
          trending_score,
          votes,
          follower_count,
          view_count
        )
      `)
      .eq('is_active', true)
      .eq('bot_contract_registered', true)
      .eq('token_id', resolvedTokenId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 온체인 가격 조회
    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    if (!rpcUrl) {
      throw new Error("BASE_RPC_URL not configured");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(BOT_CONTRACT_ADDRESS, botContractAbi, provider);

    const tokenIdBigInt = BigInt(tokenData.token_id);
    
    let onchainPrice = 0;
    let buyCost = 0;
    let sellRefund = 0;
    let onchainSupply = 0;

    try {
      // V3: 각 호출을 독립적으로 처리 (supply 0일때 sellRefund가 revert되므로)
      const [currentPrice, tokenInfo, buyCostResult] = await Promise.all([
        contract.price(tokenIdBigInt),
        contract.info(tokenIdBigInt),
        contract.buyCost(tokenIdBigInt),
      ]);

      onchainPrice = Number(currentPrice) / 1e6;
      onchainSupply = Number(tokenInfo[0]);
      buyCost = Number(buyCostResult[3]) / 1e6; // total

      // sellRefund는 온체인 supply > 0일 때만 호출
      if (onchainSupply > 0) {
        try {
          const sellRefundResult = await contract.sellRefund(tokenIdBigInt);
          sellRefund = Number(sellRefundResult[2]) / 1e6; // net
        } catch {
          console.log("sellRefund failed (supply might be 0 on-chain)");
        }
      }
    } catch (err) {
      console.log("Token not registered on Bot Contract, using DB price");
      const sqrtSupply = Math.sqrt(tokenData.total_supply);
      onchainPrice = tokenData.base_price + (tokenData.k_value / 1e12 * sqrtSupply);
    }

    // Firecrawl로 뉴스 시그널 수집
    let newsSignals = null;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const wikiEntry = tokenData.wiki_entry as unknown as { id: string; title: string; trending_score: number; votes: number; follower_count: number; view_count: number } | null;
    const wikiTitle = wikiEntry?.title;

    if (firecrawlApiKey && wikiTitle) {
      try {
        const searchQuery = `${wikiTitle} K-pop news`;
        const newsResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
            tbs: 'qdr:d', // 최근 24시간
          }),
        });

        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          const articles = newsData.data || [];
          
          newsSignals = {
            article_count_24h: articles.length,
            headlines: articles.slice(0, 3).map((a: any) => ({
              title: a.title,
              url: a.url,
            })),
            has_recent_news: articles.length > 0,
          };
        }
      } catch (err) {
        console.error("Firecrawl search error:", err);
      }
    }

    // 24시간 가격 변동 계산 — Bot Contract 거래 기록 기준
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let priceChange24h: string | null = null;

    // 1. Bot Contract 거래(agent_transactions)에서 24시간 전 가격 조회
    const { data: botOldTx } = await supabase
      .from('agent_transactions')
      .select('price_usdc')
      .eq('fanz_token_id', tokenData.id)
      .eq('status', 'confirmed')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (botOldTx) {
      priceChange24h = ((onchainPrice - botOldTx.price_usdc) / botOldTx.price_usdc * 100).toFixed(2);
    } else {
      // 2. Bot 거래 기록이 없으면 bot_transactions 테이블도 확인
      const { data: botOldTx2 } = await supabase
        .from('bot_transactions')
        .select('price_usdc')
        .eq('fanz_token_id', tokenData.id)
        .eq('status', 'confirmed')
        .gte('created_at', yesterday)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (botOldTx2) {
        priceChange24h = ((onchainPrice - botOldTx2.price_usdc) / botOldTx2.price_usdc * 100).toFixed(2);
      }
      // 거래 기록이 전혀 없으면 null 유지 (변동률 표시 안 함)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          // 기본 정보
          token_id: tokenData.token_id,
          artist_name: wikiTitle || 'Unknown',
          
          // 가격 정보
          current_price_usdc: onchainPrice,
          buy_cost_usdc: buyCost,
          sell_refund_usdc: sellRefund,
          price_change_24h: priceChange24h,
          price_change_note: priceChange24h === null 
            ? "No trading activity in the last 24 hours. Do NOT calculate or estimate price change yourself — report it as 'No recent data'."
            : undefined,
          
          // 공급량
          total_supply: onchainSupply !== undefined ? onchainSupply : tokenData.total_supply,
          
          // 인기도 지표 (온플랫폼)
          trending_score: wikiEntry?.trending_score || 0,
          votes: wikiEntry?.votes || 0,
          follower_count: wikiEntry?.follower_count || 0,
          view_count: wikiEntry?.view_count || 0,
          
          // 외부 인기도 시그널 (Firecrawl)
          external_signals: newsSignals,
          
          // 거래 컨텍스트
          trading_context: {
            contract_address: BOT_CONTRACT_ADDRESS,
            fee_structure: {
              buy_fee_percent: 3,
              sell_fee_percent: 2,
              round_trip_fee_percent: 5,
              spread_warning: "IMPORTANT: The difference between buy_cost and sell_refund is NOT the fee percentage. It includes BOTH the 5% round-trip fees AND the bonding curve price difference (buy price is calculated at supply+1, sell price at current supply). Do NOT calculate spread as (buy-sell)/buy and report it as 'trading cost' — the actual fee is always exactly 5% round-trip (3% buy + 2% sell)."
            },
            note: "Price increases with each purchase (bonding curve). Early buyers benefit from appreciation.",
            supply_status: (onchainSupply !== undefined ? onchainSupply : tokenData.total_supply) === 0
              ? "No tokens currently exist on the Bot Contract. sell_refund_usdc=0 is normal. The current_price_usdc shows the base bonding curve price. Buying now means getting in at the lowest price."
              : `${onchainSupply} tokens in circulation. sell_refund_usdc shows the net USDC you receive after selling 1 token.`
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
