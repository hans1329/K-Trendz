import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-api-key',
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// FanzTokenBotV3 컨트랙트 (User-Funded Delegated Trading)
const BOT_CONTRACT_ADDRESS = "0xBBf57b07847E355667D4f8583016dD395c5cB1D1";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 토큰 목록은 공개 데이터 — 인증 불필요
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Bot Contract에 등록된 토큰만 조회
    const { data: tokens, error: tokenError } = await supabase
      .from('fanz_tokens')
      .select(`
        token_id,
        total_supply,
        base_price,
        wiki_entry:wiki_entries!fanz_tokens_wiki_entry_id_fkey (
          title,
          trending_score,
          follower_count
        )
      `)
      .eq('is_active', true)
      .eq('bot_contract_registered', true)
      .order('total_supply', { ascending: false });

    if (tokenError) {
      throw new Error(`Failed to fetch tokens: ${tokenError.message}`);
    }

    // 응답 포맷팅
    const formattedTokens = (tokens || []).map((t) => {
      const wikiEntry = t.wiki_entry as unknown as { title: string; trending_score: number; follower_count: number } | null;
      return {
        token_id: t.token_id,
        artist_name: wikiEntry?.title || 'Unknown',
        total_supply: t.total_supply,
        trending_score: wikiEntry?.trending_score || 0,
        follower_count: wikiEntry?.follower_count || 0,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          contract_address: BOT_CONTRACT_ADDRESS,
          token_count: formattedTokens.length,
          tokens: formattedTokens,
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
