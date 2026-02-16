import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contractAddress = "0x45dB0DA161Ede30990f827b09881938CDFfE1df6";

    return new Response(
      JSON.stringify({
        address: contractAddress,
        symbol: "KTNZ",
        decimals: 18,
        name: "K-Trendz",
        image: "https://auth.k-trendz.com/storage/v1/object/public/brand_assets/logo_7.png"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error getting token info:", error);
    
    return new Response(
      JSON.stringify({ error: "Failed to get token information" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
