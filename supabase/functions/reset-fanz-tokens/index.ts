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

    console.log("Starting FULL Fanz Token reset (balances + transactions + tokens)...");

    // Delete all balances
    const { error: balanceError } = await supabaseAdmin
      .from('fanz_balances')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (balanceError) {
      console.error("Error deleting fanz_balances:", balanceError);
      throw balanceError;
    }

    // Delete all transactions
    const { error: txError } = await supabaseAdmin
      .from('fanz_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (txError) {
      console.error("Error deleting fanz_transactions:", txError);
      throw txError;
    }

    // Delete all tokens
    const { data: deletedTokens, error: tokenError } = await supabaseAdmin
      .from('fanz_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (tokenError) {
      console.error("Error deleting fanz_tokens:", tokenError);
      throw tokenError;
    }

    const deletedCount = deletedTokens?.length || 0;
    console.log(`Successfully deleted ${deletedCount} Fanz Tokens (and all balances & transactions)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${deletedCount} Fanz Tokens and all related balances/transactions`,
        deletedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in reset-fanz-tokens:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
