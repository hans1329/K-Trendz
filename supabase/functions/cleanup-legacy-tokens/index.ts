import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      throw new Error("Admin access required");
    }

    console.log("Starting legacy token cleanup...");

    // Find all legacy tokens (contract_address is null)
    const { data: legacyTokens, error: fetchError } = await supabaseAdmin
      .from('fanz_tokens')
      .select('id, token_id, wiki_entry_id, post_id, creator_id')
      .is('contract_address', null);

    if (fetchError) {
      console.error("Error fetching legacy tokens:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${legacyTokens?.length || 0} legacy tokens to delete`);

    if (!legacyTokens || legacyTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No legacy tokens found",
          deletedCount: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Delete legacy token balances first
    const tokenIds = legacyTokens.map(t => t.id);
    const { error: balanceError } = await supabaseAdmin
      .from('fanz_balances')
      .delete()
      .in('fanz_token_id', tokenIds);

    if (balanceError) {
      console.error("Error deleting balances:", balanceError);
    }

    // Delete legacy token transactions
    const { error: txError } = await supabaseAdmin
      .from('fanz_transactions')
      .delete()
      .in('fanz_token_id', tokenIds);

    if (txError) {
      console.error("Error deleting transactions:", txError);
    }

    // Delete legacy tokens
    const { error: deleteError } = await supabaseAdmin
      .from('fanz_tokens')
      .delete()
      .in('id', tokenIds);

    if (deleteError) {
      console.error("Error deleting tokens:", deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${legacyTokens.length} legacy tokens`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully deleted ${legacyTokens.length} legacy tokens`,
        deletedCount: legacyTokens.length,
        deletedTokens: legacyTokens
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in cleanup-legacy-tokens:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
