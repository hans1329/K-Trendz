// 이메일 신규 가입 자동 차단 Edge Function
// Supabase Database Webhook (auth.users INSERT)에서 호출됨
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Database Webhook payload 형식: { type, table, record, schema, old_record }
    const record = payload.record || payload;
    
    // 이메일 provider로 가입한 새 계정인지 확인
    const provider = record?.raw_app_meta_data?.provider || record?.app_metadata?.provider;
    const userId = record?.id;
    const email = record?.email;
    const createdAt = record?.created_at;

    console.log(`[guard-email-signup] New signup detected - provider: ${provider}, email: ${email}, id: ${userId}`);

    // 이메일 provider가 아니면 무시 (Google, Discord, Twitter 등은 통과)
    if (provider !== "email") {
      console.log(`[guard-email-signup] Non-email provider (${provider}), allowing`);
      return new Response(
        JSON.stringify({ action: "allowed", reason: "non-email provider" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 생성 시점이 최근 60초 이내인지 확인 (기존 계정 로그인 vs 신규 가입 구분)
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      const now = Date.now();
      const diffSeconds = (now - createdTime) / 1000;
      
      // 60초 이상 지난 계정은 기존 계정이므로 무시
      if (diffSeconds > 60) {
        console.log(`[guard-email-signup] Existing account (created ${diffSeconds}s ago), allowing`);
        return new Response(
          JSON.stringify({ action: "allowed", reason: "existing account" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 신규 이메일 가입 → 자동 ban 처리
    console.log(`[guard-email-signup] NEW email signup detected! Banning user: ${email} (${userId})`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. 계정 ban 처리
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: "876000h" } // ~100년 ban
    );

    if (banError) {
      console.error(`[guard-email-signup] Ban failed:`, banError);
      return new Response(
        JSON.stringify({ action: "error", error: banError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. user_bans 테이블에도 기록
    await supabaseAdmin.from("user_bans").upsert({
      user_id: userId,
      banned_by: "system",
      reason: "Automated: Email signup blocked - only social login allowed",
      is_permanent: true,
    }, { onConflict: "user_id" });

    console.log(`[guard-email-signup] Successfully banned new email signup: ${email}`);

    return new Response(
      JSON.stringify({ 
        action: "banned", 
        reason: "email signup blocked",
        userId,
        email 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[guard-email-signup] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
