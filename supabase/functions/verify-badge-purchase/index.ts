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
    const { badgeId, userId, quantity } = await req.json();
    
    if (!badgeId || !userId) {
      throw new Error("Badge ID and User ID are required");
    }

    console.log("Verifying Tebex badge purchase:", { badgeId, userId, quantity });

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Add badge to user's inventory
    const quantityParam = parseInt(quantity || "1");
    const { error: addError } = await supabaseAdmin.rpc('add_badge_to_inventory', {
      user_id_param: userId,
      badge_id_param: badgeId,
      quantity_param: quantityParam
    });

    if (addError) {
      console.error("Error adding badge to inventory:", addError);
      throw addError;
    }

    console.log("Badge added to inventory successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Badge added to inventory" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error verifying purchase:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
