// 봇 에이전트 등록 Edge Function
// wallet_address 필수 — V3 Delegated Trading 모델
import { createClient } from "npm:@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 랜덤 API 키 생성 (32바이트 hex)
function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA256 해시 생성
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// EVM 주소 유효성 검사
function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_name, wallet_address } = await req.json();

    // agent_name 검증
    if (!agent_name || typeof agent_name !== 'string' || agent_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'agent_name is required (min 2 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // wallet_address 필수 검증
    if (!wallet_address || !isValidEvmAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'wallet_address is required and must be a valid EVM address (0x...).' +
                 ' Connect your wallet on k-trendz.com/bot-trading to register.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = agent_name.trim().substring(0, 100);
    const normalizedWallet = wallet_address.toLowerCase();

    console.log("=== bot-register-agent ===");
    console.log("Agent name:", trimmedName, "Wallet:", normalizedWallet);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 동일 지갑으로 등록된 에이전트 확인
    const { data: existingByWallet } = await supabase
      .from('bot_agents')
      .select('id, name, is_active')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (existingByWallet) {
      // 동일 지갑 → API 키 재발급
      const newApiKey = generateApiKey();
      const newHash = await sha256(newApiKey);

      const { error: updateError } = await supabase
        .from('bot_agents')
        .update({
          name: trimmedName,
          api_key: newApiKey,
          api_key_hash: newHash,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByWallet.id);

      if (updateError) {
        throw new Error(`Failed to re-issue API key: ${updateError.message}`);
      }

      console.log("Re-issued API key for wallet:", normalizedWallet);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            agent_id: existingByWallet.id,
            api_key: newApiKey,
            wallet_address: normalizedWallet,
            daily_limit_usd: 100,
            message: "API key re-issued for your wallet. Previous key is now invalid.",
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 동일 이름 에이전트 확인
    const { data: existingByName } = await supabase
      .from('bot_agents')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle();

    if (existingByName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Agent name "${trimmedName}" is already taken. Choose a different name.` 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 새 에이전트 등록
    const apiKey = generateApiKey();
    const apiKeyHash = await sha256(apiKey);

    const { data: newAgent, error: insertError } = await supabase
      .from('bot_agents')
      .insert({
        id: crypto.randomUUID(),
        name: trimmedName,
        wallet_address: normalizedWallet,
        api_key: apiKey,
        api_key_hash: apiKeyHash,
        is_active: true,
        daily_limit_usd: 100,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to register agent: ${insertError.message}`);
    }

    console.log("New agent registered:", newAgent.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          agent_id: newAgent.id,
          api_key: apiKey,
          wallet_address: normalizedWallet,
          daily_limit_usd: 100,
          message: "Agent registered. Approve USDC on the V3 contract before trading.",
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("bot-register-agent error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
