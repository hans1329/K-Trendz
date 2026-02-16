import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Farcaster Mini App 결과 화면에서 내 참여/당첨/클레임 상태를 가져오기 위한 함수
// external_wallet_users 테이블은 RLS로 직접 조회가 막혀있어서 서비스 롤로 조회한다.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { challengeId, fid, walletAddress } = body ?? {};

    if (!challengeId || !fid) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: challengeId, fid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: user, error: userError } = await supabase
      .from("external_wallet_users")
      .select("id, wallet_address, source")
      .eq("fid", fid)
      .eq("source", "farcaster")
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return new Response(
        JSON.stringify({ participation: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 지갑 주소가 전달되면 일치 여부를 확인 (무차별 fid 조회 방지 목적)
    if (walletAddress && user.wallet_address && user.wallet_address.toLowerCase() !== String(walletAddress).toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Wallet address mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: participation, error: partError } = await supabase
      .from("external_challenge_participations")
      .select("id, answer, is_winner, prize_amount, claimed_at")
      .eq("challenge_id", challengeId)
      .eq("external_wallet_id", user.id)
      .maybeSingle();

    if (partError) {
      throw partError;
    }

    return new Response(
      JSON.stringify({ participation: participation ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
