import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// KTNZVesting 컨트랙트 ABI (필요한 함수만)
const VESTING_ABI = [
  "function createVestingSchedule(address beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration) external returns (uint256)",
  "function owner() view returns (address)",
  "function ktnzToken() view returns (address)",
  "event VestingScheduleCreated(uint256 indexed scheduleId, address indexed beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffEndTime, uint256 vestingEndTime)",
];

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 인증 확인 - admin만 허용
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // admin 권한 확인
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Admin access required");
    }

    const { schedule_id, beneficiary, amount, cliffDays, vestingDays, startTime } =
      await req.json();

    if (!schedule_id || !beneficiary || !amount || vestingDays === undefined) {
      throw new Error("Missing required parameters");
    }

    // 환경변수 확인
    const vestingContractAddress = Deno.env.get("KTNZ_VESTING_CONTRACT_ADDRESS");
    const backendWalletPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    const rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

    if (!vestingContractAddress) {
      // 컨트랙트가 아직 배포되지 않은 경우
      console.log("⚠️ Vesting contract not deployed yet. Saving schedule only.");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Schedule saved. Contract deployment pending.",
          txHash: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!backendWalletPrivateKey) {
      throw new Error("Backend wallet not configured");
    }

    // start_time 확보: body → DB → fallback(60초 뒤)
    let startTimeIso: string | null = startTime ?? null;

    if (!startTimeIso) {
      const { data: scheduleRow, error: scheduleErr } = await supabaseClient
        .from("vesting_schedules")
        .select("start_time")
        .eq("id", schedule_id)
        .maybeSingle();

      if (scheduleErr) {
        console.warn("⚠️ Failed to fetch schedule start_time:", scheduleErr);
      } else if (scheduleRow?.start_time) {
        startTimeIso = scheduleRow.start_time as string;
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let startTimeSec = startTimeIso
      ? Math.floor(new Date(startTimeIso).getTime() / 1000)
      : NaN;

    if (!Number.isFinite(startTimeSec)) {
      startTimeSec = nowSec + 60;
      startTimeIso = new Date(startTimeSec * 1000).toISOString();
    }

    // 컨트랙트 require(_startTime >= block.timestamp) 충족을 위해 최소 60초 미래로 보정
    if (startTimeSec < nowSec + 30) {
      startTimeSec = nowSec + 60;
      startTimeIso = new Date(startTimeSec * 1000).toISOString();

      await supabaseClient
        .from("vesting_schedules")
        .update({ start_time: startTimeIso, updated_at: new Date().toISOString() })
        .eq("id", schedule_id);
    }

    // Provider 및 Wallet 설정
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(backendWalletPrivateKey, provider);

    // Vesting 컨트랙트 인스턴스
    const vestingContract = new ethers.Contract(
      vestingContractAddress,
      VESTING_ABI,
      wallet
    );

    const contractOwner = (await vestingContract.owner()) as string;
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(
        `Backend wallet is not vesting contract owner. owner=${contractOwner} backend=${wallet.address}`
      );
    }

    // 토큰 amount를 wei로 변환 (18 decimals)
    const amountWei = ethers.parseUnits(amount.toString(), 18);

    // 기간을 초로 변환
    const cliffSeconds = (cliffDays || 0) * 24 * 60 * 60;
    const vestingSeconds = vestingDays * 24 * 60 * 60;

    const ktnzTokenAddress = (await vestingContract.ktnzToken()) as string;
    const ktnzToken = new ethers.Contract(
      ktnzTokenAddress,
      [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address owner) view returns (uint256)",
      ],
      provider
    );

    const [allowance, balance] = await Promise.all([
      ktnzToken.allowance(wallet.address, vestingContractAddress),
      ktnzToken.balanceOf(wallet.address),
    ]);

    console.log(
      `   Owner check: contractOwner=${contractOwner} backend=${wallet.address}`
    );
    console.log(`   KTNZ token: ${ktnzTokenAddress}`);
    console.log(`   Allowance: ${allowance.toString()}`);
    console.log(`   Balance: ${balance.toString()}`);

    if (allowance < amountWei) {
      throw new Error(
        `Insufficient allowance. allowance=${allowance.toString()} required=${amountWei.toString()}`
      );
    }
    if (balance < amountWei) {
      throw new Error(
        `Insufficient KTNZ balance. balance=${balance.toString()} required=${amountWei.toString()}`
      );
    }

    console.log(`📝 Creating vesting schedule for ${beneficiary}`);
    console.log(`   Amount: ${amount} KTNZ (${amountWei.toString()} wei)`);
    console.log(`   Start: ${startTimeIso} (${startTimeSec} seconds)`);
    console.log(`   Cliff: ${cliffDays} days (${cliffSeconds} seconds)`);
    console.log(`   Vesting: ${vestingDays} days (${vestingSeconds} seconds)`);

    // 컨트랙트 호출 (KTNZVesting.sol 기준)
    const tx = await vestingContract.createVestingSchedule(
      beneficiary,
      amountWei,
      BigInt(startTimeSec),
      BigInt(cliffSeconds),
      BigInt(vestingSeconds)
    );

    console.log(`📤 Transaction sent: ${tx.hash}`);

    // 트랜잭션 확인 대기
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // VestingScheduleCreated 이벤트에서 scheduleId 추출
    let onchainScheduleId: number | null = null;
    const vestingInterface = new ethers.Interface(VESTING_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = vestingInterface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === "VestingScheduleCreated") {
          onchainScheduleId = Number(parsed.args[0]); // scheduleId
          console.log(`📋 Extracted onchain_schedule_id: ${onchainScheduleId}`);
          break;
        }
      } catch {
        // skip non-matching logs
      }
    }

    // DB 업데이트
    await supabaseClient
      .from("vesting_schedules")
      .update({
        tx_hash: tx.hash,
        status: "active",
        onchain_schedule_id: onchainScheduleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule_id);

    return new Response(
      JSON.stringify({
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating vesting:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
