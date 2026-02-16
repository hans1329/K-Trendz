import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// KTNZVesting 컨트랙트 ABI
const VESTING_ABI = [
  "function revokeVesting(uint256 _scheduleId) external",
  "function owner() public view returns (address)",
  "function getVestingScheduleInfo(uint256 _scheduleId) external view returns (address beneficiary, uint256 totalAmount, uint256 claimedAmount, uint256 claimableAmount, uint256 startTime, uint256 cliffEndTime, uint256 vestingEndTime, bool revoked)",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. 인증 확인
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. admin 권한 확인
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // admin 권한 확인
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. 요청 파싱
    const { schedule_id, onchain_schedule_id } = await req.json();

    if (!schedule_id || onchain_schedule_id === undefined) {
      return new Response(JSON.stringify({ error: "Missing schedule_id or onchain_schedule_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. 환경 변수
    const contractAddress = Deno.env.get("KTNZ_VESTING_CONTRACT_ADDRESS");
    const backendPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

    if (!contractAddress || !backendPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing contract configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. 프로바이더 및 월렛 설정
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(backendPrivateKey, provider);
    const vestingContract = new ethers.Contract(contractAddress, VESTING_ABI, wallet);

    // 6. 컨트랙트 owner 확인
    const contractOwner = await vestingContract.owner();
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Backend wallet is not the contract owner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. 현재 스케줄 상태 확인
    const scheduleInfo = await vestingContract.getVestingScheduleInfo(onchain_schedule_id);
    if (scheduleInfo.revoked) {
      return new Response(JSON.stringify({ error: "Schedule already revoked" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Revoking vesting schedule ${onchain_schedule_id} for beneficiary ${scheduleInfo.beneficiary}`);
    console.log(`Total: ${ethers.formatEther(scheduleInfo.totalAmount)} KTNZ, Claimed: ${ethers.formatEther(scheduleInfo.claimedAmount)} KTNZ`);

    // 8. revokeVesting 호출
    const tx = await vestingContract.revokeVesting(onchain_schedule_id);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    // 9. DB 업데이트
    const { error: updateError } = await adminClient
      .from("vesting_schedules")
      .update({ 
        status: "cancelled",
        revoked_at: new Date().toISOString(),
        revoke_tx_hash: tx.hash,
      })
      .eq("id", schedule_id);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        vestedAmount: ethers.formatEther(scheduleInfo.claimedAmount),
        returnedAmount: ethers.formatEther(scheduleInfo.totalAmount - scheduleInfo.claimedAmount),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Revoke vesting error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to revoke vesting" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
