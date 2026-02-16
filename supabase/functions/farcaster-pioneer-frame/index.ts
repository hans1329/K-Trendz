import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRAME_IMAGE_URL = "https://k-trendz.com/images/pioneer-frame.jpg";
const FRAME_POST_URL = "https://k-trendz.com/api/farcaster-pioneer-frame";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // GET: Return Frame HTML
    if (req.method === "GET") {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>K-Trendz Pioneer Rewards</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${FRAME_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Claim Pioneer Rewards 🎁" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:post_url" content="${FRAME_POST_URL}" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="K-Trendz Pioneer Rewards 🌟" />
  <meta property="og:description" content="Be an early K-Trendz pioneer! Claim 500 Stars + Exclusive Pioneer Badge" />
  <meta property="og:image" content="${FRAME_IMAGE_URL}" />
</head>
<body>
  <h1>K-Trendz Pioneer Rewards</h1>
  <p>Be an early K-Trendz pioneer and claim your exclusive rewards on Farcaster!</p>
  <img src="${FRAME_IMAGE_URL}" alt="Pioneer Rewards" style="max-width: 100%; height: auto;" />
</body>
</html>
`;

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // POST: Process Frame button click
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Farcaster Frame POST data:", body);

      const { untrustedData } = body;
      
      if (!untrustedData || !untrustedData.fid) {
        throw new Error("Invalid Farcaster data: missing fid");
      }

      const fid = untrustedData.fid;
      const walletAddress = untrustedData.address;

      if (!walletAddress) {
        throw new Error("Wallet address not found. Please connect your Base wallet in Farcaster.");
      }

      console.log(`Processing claim for fid: ${fid}, wallet: ${walletAddress}`);

      // Check if already claimed
      const { data: existingClaim } = await supabaseAdmin
        .from("pioneer_claims")
        .select("*")
        .eq("fid", fid)
        .single();

      if (existingClaim) {
        console.log(`fid ${fid} already claimed`);
        
        // Return success frame with "Already Claimed" message
        const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${FRAME_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Already Claimed ✓" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://k-trendz.com" />
</head>
<body>
  <h1>Already Claimed!</h1>
  <p>You have already claimed your Pioneer rewards.</p>
</body>
</html>
`;
        return new Response(successHtml, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      }

      // Record the claim
      const { error: claimError } = await supabaseAdmin
        .from("pioneer_claims")
        .insert({
          fid,
          wallet_address: walletAddress,
        });

      if (claimError) {
        console.error("Error recording claim:", claimError);
        throw claimError;
      }

      // Find user by wallet address
      const { data: walletData } = await supabaseAdmin
        .from("wallet_addresses")
        .select("user_id")
        .eq("wallet_address", walletAddress)
        .eq("network", "base")
        .single();

      let userId = walletData?.user_id;

      // If user exists, grant rewards
      if (userId) {
        console.log(`Granting rewards to user ${userId}`);

        // Get current points
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("available_points, total_points")
          .eq("id", userId)
          .single();

        if (profile) {
          // Award 500 Stars
          const { error: pointsError } = await supabaseAdmin
            .from("profiles")
            .update({
              available_points: profile.available_points + 500,
              total_points: profile.total_points + 500,
            })
            .eq("id", userId);

          if (pointsError) {
            console.error("Error awarding points:", pointsError);
          }

          // Record transaction
          await supabaseAdmin
            .from("point_transactions")
            .insert({
              user_id: userId,
              action_type: "pioneer_reward",
              points: 500,
            });
        }

        // Get Pioneer badge
        const { data: badge } = await supabaseAdmin
          .from("gift_badges")
          .select("id")
          .eq("name", "Pioneer")
          .single();

        if (badge) {
          // Add badge to inventory
          await supabaseAdmin.rpc("add_badge_to_inventory", {
            user_id_param: userId,
            badge_id_param: badge.id,
            quantity_param: 1,
          });
        }

        // Update claim record with user_id
        await supabaseAdmin
          .from("pioneer_claims")
          .update({ user_id: userId })
          .eq("fid", fid);

        console.log(`Rewards granted successfully to user ${userId}`);
      } else {
        console.log(`User not found for wallet ${walletAddress}, claim recorded for future connection`);
      }

      // Return success frame
      const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${FRAME_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Visit K-Trendz 🚀" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://k-trendz.com" />
</head>
<body>
  <h1>Success!</h1>
  <p>Your Pioneer rewards have been claimed!</p>
  ${userId ? '<p>500 Stars + Pioneer Badge added to your account.</p>' : '<p>Your rewards will be credited when you connect this wallet to K-Trendz.</p>'}
</body>
</html>
`;

      return new Response(successHtml, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error("Error processing frame:", error);
    
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${FRAME_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Try Again" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:post_url" content="${FRAME_POST_URL}" />
</head>
<body>
  <h1>Error</h1>
  <p>${error instanceof Error ? error.message : "An error occurred"}</p>
</body>
</html>
`;

    return new Response(errorHtml, {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }
});
