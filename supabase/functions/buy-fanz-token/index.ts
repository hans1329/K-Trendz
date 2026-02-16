import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "npm:ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DAU 기록용 헬퍼 함수
const ACTIVITY_FANZ_BUY = ethers.keccak256(ethers.toUtf8Bytes("fanz_buy"));

async function recordDAUActivity(
  userId: string,
  activityType: string,
  referenceHash: string,
  supabase: any
): Promise<void> {
  const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS");
  const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
  const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
  const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
  
  if (!dauContractAddress || !paymasterUrl || !operatorPrivateKey) {
    console.log("DAU recording skipped - missing config");
    return;
  }

  try {
    // 사용자 지갑 주소 조회 (smart wallet 우선, 여러 지갑 존재 시 첫 번째 사용)
    const { data: walletRows } = await supabase
      .from("wallet_addresses")
      .select("wallet_address, wallet_type")
      .eq("user_id", userId)
      .eq("network", "base")
      .order("wallet_type", { ascending: true })
      .limit(1);
    const walletData = walletRows?.[0] ?? null;

    if (!walletData?.wallet_address) {
      console.log("DAU recording skipped - no wallet");
      return;
    }

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
    const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    // DAU calldata
    const dauInterface = new ethers.Interface([
      "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
    ]);
    const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
      walletData.wallet_address,
      activityType,
      referenceHash,
    ]);

    const accountInterface = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external",
    ]);
    const executeCalldata = accountInterface.encodeFunctionData("execute", [
      dauContractAddress,
      0n,
      dauCalldata,
    ]);

    // nonce 조회
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ]);
    const nonceData = await provider.call({
      to: ENTRY_POINT_ADDRESS,
      data: entryPointInterface.encodeFunctionData("getNonce", [BACKEND_SMART_ACCOUNT, 0n]),
    });
    const nonce = BigInt(nonceData);

    const feeData = await provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas ?? ethers.parseUnits("0.5", "gwei")) as bigint;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.1", "gwei")) as bigint;

    const userOp = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      callGasLimit: "0x15f90",
      verificationGasLimit: "0x15f90",
      preVerificationGas: "0x5208",
      maxFeePerGas: "0x" + maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Paymaster 요청
    const pmResponse = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1, jsonrpc: "2.0", method: "pm_getPaymasterData",
        params: [userOp, ENTRY_POINT_ADDRESS, "0x2105", {}],
      }),
    });
    const pmResult = await pmResponse.json();
    if (pmResult.error) throw new Error(pmResult.error.message);
    userOp.paymasterAndData = pmResult.result?.paymasterAndData || "0x";

    // UserOp 서명
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [userOp.sender, BigInt(userOp.nonce), ethers.keccak256(userOp.initCode), ethers.keccak256(userOp.callData),
       BigInt(userOp.callGasLimit), BigInt(userOp.verificationGasLimit), BigInt(userOp.preVerificationGas),
       BigInt(userOp.maxFeePerGas), BigInt(userOp.maxPriorityFeePerGas), ethers.keccak256(userOp.paymasterAndData)]
    );
    const userOpHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT_ADDRESS, 8453n])
    );
    userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

    // Bundler 제출 (결과 대기 없이 백그라운드 처리)
    fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "eth_sendUserOperation", params: [userOp, ENTRY_POINT_ADDRESS] }),
    }).catch(e => console.error("DAU bundler error:", e));

    console.log("DAU activity recorded for:", userId);
  } catch (e) {
    console.error("DAU recording error:", e);
  }
}

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { tokenId, amount, maxCost } = await req.json();

    if (!tokenId || !amount || amount <= 0) {
      throw new Error("Invalid request parameters");
    }

    if (!maxCost || maxCost <= 0) {
      throw new Error("maxCost is required for slippage protection");
    }

    // Fanz 토큰 정보 조회
    const { data: fanzToken, error: tokenError } = await supabaseAdmin
      .from('fanz_tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('is_active', true)
      .single();

    if (tokenError || !fanzToken) {
      throw new Error("Token not found");
    }

    // 현재 가격 계산 (P(s) = basePrice + k * sqrt(supply))
    const currentSupply = fanzToken.total_supply;
    const currentPrice = fanzToken.base_price + (fanzToken.k_value * Math.sqrt(currentSupply));
    
    // ETH를 USD로 환산 (ETH = $3000 기준)
    const ETH_TO_USD = 3000;
    const priceInUSD = currentPrice * ETH_TO_USD;
    
    // 포인트 필요량 계산 (1 포인트 = 0.01 USD)
    const USD_TO_POINTS = 100;
    const totalAmount = amount;
    const avgPrice = fanzToken.base_price + (fanzToken.k_value * (Math.sqrt(currentSupply + totalAmount) + Math.sqrt(currentSupply)) / 2);
    const totalPriceUSD = avgPrice * totalAmount * ETH_TO_USD;
    const requiredPoints = Math.ceil(totalPriceUSD * USD_TO_POINTS);

    // 슬리피지 보호: 실제 가격이 maxCost 초과 시 거부
    if (requiredPoints > maxCost) {
      throw new Error(`Price increased. Required: ${requiredPoints}, Max allowed: ${maxCost}. Please try again.`);
    }

    // 사용자 포인트 확인
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('available_points')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    if (profile.available_points < requiredPoints) {
      throw new Error(`Insufficient points. Required: ${requiredPoints}, Available: ${profile.available_points}`);
    }

    // 트랜잭션 시작: 포인트 차감
    const { error: pointsError } = await supabaseAdmin
      .from('profiles')
      .update({ available_points: profile.available_points - requiredPoints })
      .eq('id', user.id);

    if (pointsError) {
      throw new Error("Failed to deduct points");
    }

    // 포인트 거래 기록
    await supabaseAdmin
      .from('point_transactions')
      .insert({
        user_id: user.id,
        action_type: 'buy_fanz_token',
        points: -requiredPoints,
        reference_id: tokenId
      });

    // Fanz 토큰 잔액 업데이트 또는 생성
    const { data: existingBalance } = await supabaseAdmin
      .from('fanz_balances')
      .select('balance')
      .eq('user_id', user.id)
      .eq('fanz_token_id', tokenId)
      .single();

    if (existingBalance) {
      await supabaseAdmin
        .from('fanz_balances')
        .update({ balance: existingBalance.balance + totalAmount })
        .eq('user_id', user.id)
        .eq('fanz_token_id', tokenId);
    } else {
      await supabaseAdmin
        .from('fanz_balances')
        .insert({
          user_id: user.id,
          fanz_token_id: tokenId,
          balance: totalAmount
        });
    }

    // Fanz 토큰 총 공급량 업데이트
    await supabaseAdmin
      .from('fanz_tokens')
      .update({ total_supply: currentSupply + totalAmount })
      .eq('id', tokenId);

    // 거래 기록
    const finalPrice = fanzToken.base_price + (fanzToken.k_value * Math.sqrt(currentSupply + totalAmount));
    await supabaseAdmin
      .from('fanz_transactions')
      .insert({
        user_id: user.id,
        fanz_token_id: tokenId,
        transaction_type: 'buy',
        amount: totalAmount,
        price_per_token: finalPrice,
        total_value: totalPriceUSD,
        payment_value: requiredPoints / USD_TO_POINTS,
        payment_token: 'POINTS',
        creator_fee: 0,
        platform_fee: 0
      });

    console.log(`Fanz token purchased: ${amount} tokens for ${requiredPoints} points`);

    // DAU 기록 (백그라운드 처리 - 실패해도 메인 응답에 영향 없음)
    const tokenHash = ethers.keccak256(ethers.toUtf8Bytes(tokenId));
    recordDAUActivity(user.id, ACTIVITY_FANZ_BUY, tokenHash, supabaseAdmin).catch(e => 
      console.error("DAU background error:", e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        amount: totalAmount,
        pointsSpent: requiredPoints,
        newBalance: existingBalance ? existingBalance.balance + totalAmount : totalAmount,
        message: "Fanz token purchased successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error buying fanz token:", error);
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