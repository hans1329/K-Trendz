// Admin Approve Agent Edge Function
// - 관리자가 pending 에이전트를 승인/거부

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 관리자 인증 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 관리자 권한 확인
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      agent_id, 
      action,  // 'approve' | 'reject' | 'suspend'
      daily_limit_usd,
      daily_tx_limit,
      paymaster_approved
    } = await req.json();

    if (!agent_id || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "agent_id and action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== admin-approve-agent ===");
    console.log("Admin:", user.email);
    console.log("Agent ID:", agent_id);
    console.log("Action:", action);

    // 에이전트 존재 확인
    const { data: agent, error: agentError } = await supabase
      .from("verified_agents")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 액션에 따른 업데이트
    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "approve":
        updateData = {
          status: "verified",
          verified_at: new Date().toISOString(),
          paymaster_approved: paymaster_approved !== undefined ? paymaster_approved : true,
          daily_limit_usd: daily_limit_usd || agent.daily_limit_usd,
          daily_tx_limit: daily_tx_limit || agent.daily_tx_limit
        };
        break;

      case "reject":
        updateData = {
          status: "rejected",
          paymaster_approved: false
        };
        break;

      case "suspend":
        updateData = {
          status: "suspended",
          paymaster_approved: false
        };
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action. Use: approve, reject, suspend" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const { data: updatedAgent, error: updateError } = await supabase
      .from("verified_agents")
      .update(updateData)
      .eq("id", agent_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update agent: ${updateError.message}`);
    }

    console.log("Agent updated:", updatedAgent.status);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: updatedAgent.id,
          wallet_address: updatedAgent.wallet_address,
          status: updatedAgent.status,
          paymaster_approved: updatedAgent.paymaster_approved,
          daily_limit_usd: updatedAgent.daily_limit_usd,
          daily_tx_limit: updatedAgent.daily_tx_limit,
          verified_at: updatedAgent.verified_at
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Admin approve agent error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
