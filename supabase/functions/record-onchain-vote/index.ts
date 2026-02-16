// K-Trendz 온체인 투표 기록 Edge Function (Backend 대행 방식)
// - Backend Smart Account가 모든 투표를 대행
// - 사용자 Smart Account 배포 불필요 → 비용 절감
// - actualVoter 파라미터로 실제 투표자 추적 가능

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

// 배포 추적용(로그/응답에 포함)
// NOTE: 문제 추적 시 버전을 올려가며 실제 반영 여부를 확인한다.
const VERSION = "2026-02-01.1";
const DEPLOYED_AT = "2026-02-01T00:00:00Z";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // 브라우저에서 Supabase SDK가 보내는 추가 헤더 때문에 CORS preflight가 실패할 수 있어 확장 헤더를 허용
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// KTrendzVoteV3 ABI (actualVoter indexed로 추적 가능)
const VOTE_CONTRACT_ABI = [
  "function vote(address actualVoter, bytes32 artistHash, bytes32 inviteCodeHash, uint256 voteCount) external",
  "function owner() view returns (address)",
  "function operator() view returns (address)",
];

// SimpleAccount execute ABI
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, bytes[] calldata func) external",
  "function owner() view returns (address)",
];

// KTrendzDAU ABI
const DAU_CONTRACT_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
];

// DAU 활동 타입 해시 (컨트랙트와 동일)
const ACTIVITY_VOTE = ethers.keccak256(ethers.toUtf8Bytes("vote"));

// EntryPoint address (ERC-4337 v0.6)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Backend Smart Account (이미 배포됨)
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[record-onchain-vote] boot VERSION=${VERSION} DEPLOYED_AT=${DEPLOYED_AT}`);

    // 안전한 디버그 엔드포인트 (온체인 트랜잭션 발생 없음)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const userOpHash = url.searchParams.get("userOpHash");

      const voteContractAddress = Deno.env.get("VOTE_CONTRACT_ADDRESS") || null;
      const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS") || null;
      const baseRpcUrlFromEnv = Deno.env.get("BASE_RPC_URL") || null;
      const hasAlchemyKey = Boolean(Deno.env.get("ALCHEMY_API_KEY"));

      let userOpReceipt: unknown = null;
      let userOpReceiptError: unknown = null;

      if (userOpHash) {
        try {
          if (!/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
            throw new Error("Invalid userOpHash format");
          }

          const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
          if (!paymasterUrl) {
            throw new Error("Missing COINBASE_PAYMASTER_URL");
          }

          const response = await fetch(paymasterUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "eth_getUserOperationReceipt",
              params: [userOpHash],
            }),
          });
          const result = await response.json();
          if (result?.error) {
            userOpReceiptError = result.error;
          } else {
            userOpReceipt = result.result ?? null;
          }
        } catch (e) {
          userOpReceiptError = e instanceof Error ? e.message : String(e);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          _version: VERSION,
          _deployedAt: DEPLOYED_AT,
          voteContractAddress,
          dauContractAddress,
          entryPoint: ENTRY_POINT_ADDRESS,
          backendSmartAccount: BACKEND_SMART_ACCOUNT,
          baseRpcUrlFromEnv,
          hasAlchemyKey,
          userOpHash: userOpHash ?? null,
          userOpReceipt,
          userOpReceiptError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== record-onchain-vote (Backend delegation) start ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Alchemy 우선 사용 (가능하면), 없으면 BASE_RPC_URL, 마지막으로 Public RPC fallback
    const baseRpcUrlFromEnv = Deno.env.get("BASE_RPC_URL");
    const alchemyApiKey = Deno.env.get("ALCHEMY_API_KEY");
    const alchemyRpcUrl = alchemyApiKey ? `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}` : null;
    const baseRpcUrl = baseRpcUrlFromEnv || alchemyRpcUrl || "https://mainnet.base.org";

    try {
      console.log("RPC provider host:", new URL(baseRpcUrl).host);
    } catch {
      console.log("RPC provider: (invalid url)");
    }

    const voteContractAddress = Deno.env.get("VOTE_CONTRACT_ADDRESS");
    const operatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");

    if (!voteContractAddress) throw new Error("Missing VOTE_CONTRACT_ADDRESS");
    if (!operatorPrivateKey) throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY");
    if (!paymasterUrl) throw new Error("Missing COINBASE_PAYMASTER_URL");

    const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS") || "";

    console.log("Config snapshot:", {
      voteContractAddress,
      dauContractAddress: dauContractAddress || null,
      entryPoint: ENTRY_POINT_ADDRESS,
      backendSmartAccount: BACKEND_SMART_ACCOUNT,
      chainId: 8453,
      _version: VERSION,
    });

    const { eventId, voterAddressOrUserId, artistName, inviteCode = "", voteCount } = await req.json();

    if (!voterAddressOrUserId || !artistName || !voteCount) {
      throw new Error("Missing required parameters: voterAddressOrUserId, artistName, voteCount");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // voter 주소 해석
    let voterAddress = "";

    if (ethers.isAddress(voterAddressOrUserId)) {
      voterAddress = voterAddressOrUserId;
    } else {
      // userId인 경우 wallet_addresses에서 조회
      // NOTE: 한 유저가 external + smart_wallet 등 여러 레코드를 가질 수 있어 maybeSingle()이 실패(다중행)할 수 있음
      //       → 우선 smart_wallet을 최신순으로 1개만 가져오고, 없으면 fallback으로 아무 지갑이나 1개 가져온다.

      const { data: smartWalletData, error: smartWalletError } = await supabase
        .from("wallet_addresses")
        .select("wallet_address")
        .eq("user_id", voterAddressOrUserId)
        .eq("wallet_type", "smart_wallet")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (smartWalletError) {
        console.warn("Failed to fetch smart_wallet address:", smartWalletError.message);
      }

      if (smartWalletData?.wallet_address && ethers.isAddress(smartWalletData.wallet_address)) {
        voterAddress = smartWalletData.wallet_address;
      } else {
        const { data: anyWalletData, error: anyWalletError } = await supabase
          .from("wallet_addresses")
          .select("wallet_address")
          .eq("user_id", voterAddressOrUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyWalletError) {
          console.warn("Failed to fetch any wallet address:", anyWalletError.message);
        }

        if (anyWalletData?.wallet_address && ethers.isAddress(anyWalletData.wallet_address)) {
          voterAddress = anyWalletData.wallet_address;
        }
      }
    }

    if (!voterAddress) {
      throw new Error("Could not resolve voter wallet address");
    }

    console.log("Resolved voter address:", voterAddress);

    // artistName과 inviteCode를 bytes32 해시로 변환
    const artistHash = ethers.keccak256(ethers.toUtf8Bytes(artistName));
    const inviteCodeHash = inviteCode
      ? ethers.keccak256(ethers.toUtf8Bytes(inviteCode))
      : ethers.ZeroHash;

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const feeData = await provider.getFeeData();
    const baseFee = feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.parseUnits("0.1", "gwei");
    const basePriority = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.05", "gwei");

    // "replacement underpriced" 방지: 최소 50% 버퍼 적용 + 최소값 보장
    // pending 트랜잭션 대체 시 최소 10% 이상 높아야 하므로 넉넉히 50% 버퍼
    const minMaxFeePerGas = ethers.parseUnits("0.15", "gwei");  // 최소 0.15 Gwei
    const minPriorityFeePerGas = ethers.parseUnits("0.08", "gwei");  // 최소 0.08 Gwei
    
    // Gas fee cap to prevent exceeding Paymaster limits
    // NOTE: 투표(UserOp)는 보통 450k gas 내외라 10 gwei까지 올려도 $20 스폰서 한도 내에서 대부분 안전.
    //       (너무 낮게 cap하면 replacement underpriced를 해결할 수 없음)
    const maxFeePerGasCap = ethers.parseUnits("10", "gwei");
    const maxPriorityFeePerGasCap = ethers.parseUnits("2", "gwei");
    
    // 50% 버퍼 적용 후 cap과 비교
    let maxFeePerGas = (baseFee * 15n) / 10n;  // 50% 버퍼
    let maxPriorityFeePerGas = (basePriority * 15n) / 10n;  // 50% 버퍼
    
    // 최소값 보장
    if (maxFeePerGas < minMaxFeePerGas) maxFeePerGas = minMaxFeePerGas;
    if (maxPriorityFeePerGas < minPriorityFeePerGas) maxPriorityFeePerGas = minPriorityFeePerGas;
    
    // cap 적용
    if (maxFeePerGas > maxFeePerGasCap) maxFeePerGas = maxFeePerGasCap;
    if (maxPriorityFeePerGas > maxPriorityFeePerGasCap) maxPriorityFeePerGas = maxPriorityFeePerGasCap;

    console.log("FeeData:", { baseFee: baseFee.toString(), maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString() });

    // Backend Smart Account 사용
    console.log("=== Using Backend Smart Account ===");
    
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    // Backend Smart Account 배포 확인
    const accountCode = await provider.getCode(BACKEND_SMART_ACCOUNT);
    if (accountCode === "0x") {
      throw new Error(`Backend Smart Account is not deployed. Address: ${BACKEND_SMART_ACCOUNT}`);
    }

    // vote() calldata 생성 - actualVoter는 사용자 지갑 주소
    const voteInterface = new ethers.Interface(VOTE_CONTRACT_ABI);
    const voteCalldata = voteInterface.encodeFunctionData("vote", [
      voterAddress,  // actualVoter = 실제 투표자 주소 (이벤트 로그로 추적)
      artistHash,
      inviteCodeHash,
      BigInt(voteCount),
    ]);

    // DAU 기록 추가 (선택적 - 컨트랙트 배포 시)
    let executeCalldata: string;
    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);

    if (dauContractAddress) {
      // DAU recordActivity calldata
      const dauInterface = new ethers.Interface(DAU_CONTRACT_ABI);
      const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
        voterAddress,
        ACTIVITY_VOTE,
        artistHash,  // 아티스트 해시를 참조값으로 사용
      ]);

      // executeBatch로 vote + DAU 기록 동시 실행
      executeCalldata = accountInterface.encodeFunctionData("executeBatch", [
        [voteContractAddress, dauContractAddress],
        [voteCalldata, dauCalldata],
      ]);
      console.log("DAU recording enabled, using executeBatch");
    } else {
      // DAU 컨트랙트 없으면 기존 방식
      executeCalldata = accountInterface.encodeFunctionData("execute", [
        voteContractAddress,
        0n,
        voteCalldata,
      ]);
    }

    // nonce 조회
    // NOTE: Backend Smart Account가 모든 트랜잭션을 대행하므로 (sender) nonce가 공유됨.
    //       같은 유저가 연속으로 투표하면 mempool에 pending된 UserOp와 nonce 충돌이 발생함.
    //       이를 피하기 위해 timestamp 기반의 고유한 nonceKey를 사용하여 각 요청마다 독립적인 nonce stream을 생성.
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ]);

    // 고유한 nonce key: voterAddress의 하위 128비트 + timestamp의 하위 64비트를 조합
    // uint192 범위 내에서 충돌 가능성을 최소화
    const voterAddressLower = BigInt(voterAddress) & ((1n << 128n) - 1n);
    const timestampPart = BigInt(Date.now()) & ((1n << 64n) - 1n);
    const nonceKey = (voterAddressLower << 64n) | timestampPart;

    const nonceData = await provider.call({
      to: ENTRY_POINT_ADDRESS,
      data: entryPointInterface.encodeFunctionData("getNonce", [BACKEND_SMART_ACCOUNT, nonceKey]),
    });
    const nonce = BigInt(nonceData);

    console.log("Backend Smart Account nonce:", nonce.toString(), "nonceKey:", nonceKey.toString());

    // Smart Account owner 검증
    const smartAccount = new ethers.Contract(BACKEND_SMART_ACCOUNT, SIMPLE_ACCOUNT_ABI, provider);
    const smartAccountOwner = ethers.getAddress(await smartAccount.owner());
    const signerAddress = ethers.getAddress(ownerWallet.address);

    if (smartAccountOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(`Invalid signer: owner=${smartAccountOwner} signer=${signerAddress}`);
    }

    const baseUserOp = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x", // Backend Smart Account는 이미 배포됨
      callData: executeCalldata + BUILDER_CODE_SUFFIX,
      // NOTE: executeBatch(vote + DAU)는 200k로는 부족한 경우가 많아 UserOp가 드랍될 수 있음.
      //       (receipt가 끝내 안 나오는 케이스) → 충분히 여유있는 값으로 상향.
      callGasLimit: "0x7a120", // 500,000
      verificationGasLimit: "0x7a120", // 500,000
      preVerificationGas: "0x186a0", // 100,000
      maxFeePerGas: "0x0",
      maxPriorityFeePerGas: "0x0",
      paymasterAndData: "0x",
      signature: "0x",
    };

    // nonce 충돌로 인한 "replacement underpriced" 대응:
    // - 같은 (sender, nonce)로 이미 pending UserOp가 있으면, replacement 규칙(보통 10% 이상 fee bump)을 만족해야 함
    // - bundler가 제공하는 currentMaxFee/currentMaxPriorityFee 기준으로 20%+1wei bump를 적용해 확실히 대체되게 한다.

    let userOpHashFromBundler = "";
    let txHash = "";
    let lastBundlerError = "";

    // 다음 시도에 사용할 fee (replacement underpriced 응답을 받으면 bundler hint 기준으로 갱신)
    let attemptMaxFee = maxFeePerGas;
    let attemptMaxPriority = maxPriorityFeePerGas;

    for (let attempt = 0; attempt < 5; attempt++) {
      // 첫 시도가 아니면, 이미 attemptMaxFee/attemptMaxPriority가 bumped 된 상태

      // cap 적용
      if (attemptMaxFee > maxFeePerGasCap) attemptMaxFee = maxFeePerGasCap;
      if (attemptMaxPriority > maxPriorityFeePerGasCap) attemptMaxPriority = maxPriorityFeePerGasCap;

      // EIP-1559: maxFeePerGas >= maxPriorityFeePerGas
      if (attemptMaxFee < attemptMaxPriority) attemptMaxFee = attemptMaxPriority;

      const userOp = {
        ...baseUserOp,
        maxFeePerGas: "0x" + attemptMaxFee.toString(16),
        maxPriorityFeePerGas: "0x" + attemptMaxPriority.toString(16),
      };

      console.log("Submitting UserOp", {
        attempt,
        nonce: userOp.nonce,
        maxFeePerGas: userOp.maxFeePerGas,
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      });

      // Paymaster 스폰서십 요청
      const paymasterRequest = {
        id: 1,
        jsonrpc: "2.0",
        method: "pm_getPaymasterData",
        params: [
          {
            sender: userOp.sender,
            nonce: userOp.nonce,
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: userOp.callGasLimit,
            verificationGasLimit: userOp.verificationGasLimit,
            preVerificationGas: userOp.preVerificationGas,
            maxFeePerGas: userOp.maxFeePerGas,
            maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
          },
          ENTRY_POINT_ADDRESS,
          "0x2105", // Base chainId
          {},
        ],
      };

      const paymasterResponse = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymasterRequest),
      });

      const paymasterResult = await paymasterResponse.json();
      console.log("Paymaster response:", JSON.stringify(paymasterResult).slice(0, 500));

      if (paymasterResult.error) {
        throw new Error(`Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}`);
      }

      userOp.paymasterAndData = paymasterResult.result?.paymasterAndData || "0x";
      if (paymasterResult.result?.callGasLimit) userOp.callGasLimit = paymasterResult.result.callGasLimit;
      if (paymasterResult.result?.verificationGasLimit) userOp.verificationGasLimit = paymasterResult.result.verificationGasLimit;
      if (paymasterResult.result?.preVerificationGas) userOp.preVerificationGas = paymasterResult.result.preVerificationGas;

      // UserOperation 해시 계산 및 서명
      const userOpHash = await calculateUserOpHash(userOp, ENTRY_POINT_ADDRESS, 8453n);
      userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

      console.log("UserOp signed with backend key, submitting to Bundler...");

      const bundlerRequest = {
        id: 2,
        jsonrpc: "2.0",
        method: "eth_sendUserOperation",
        params: [userOp, ENTRY_POINT_ADDRESS],
      };

      const bundlerResponse = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundlerRequest),
      });

      const bundlerResult = await bundlerResponse.json();
      console.log("Bundler response:", JSON.stringify(bundlerResult).slice(0, 500));

      if (bundlerResult.error) {
        const msg = bundlerResult.error.message || JSON.stringify(bundlerResult.error);
        lastBundlerError = msg;

        if (msg.toLowerCase().includes("replacement underpriced")) {
          // bundler가 알려주는 "현재 pending userOp" fee를 기준으로 20%+1wei bump
          const data = bundlerResult.error?.data as any;
          const currentMaxFeeHex = data?.currentMaxFee as string | undefined;
          const currentMaxPriorityHex = data?.currentMaxPriorityFee as string | undefined;

          if (currentMaxFeeHex && currentMaxPriorityHex) {
            const currentMaxFee = BigInt(currentMaxFeeHex);
            const currentMaxPriority = BigInt(currentMaxPriorityHex);

            attemptMaxFee = (currentMaxFee * 12n) / 10n + 1n;
            attemptMaxPriority = (currentMaxPriority * 12n) / 10n + 1n;

            // cap 적용
            if (attemptMaxFee > maxFeePerGasCap) attemptMaxFee = maxFeePerGasCap;
            if (attemptMaxPriority > maxPriorityFeePerGasCap) attemptMaxPriority = maxPriorityFeePerGasCap;

            // EIP-1559
            if (attemptMaxFee < attemptMaxPriority) attemptMaxFee = attemptMaxPriority;

            console.log("Retrying with bumped fees from bundler hint", {
              currentMaxFee: currentMaxFeeHex,
              currentMaxPriorityFee: currentMaxPriorityHex,
              bumpedMaxFeePerGas: "0x" + attemptMaxFee.toString(16),
              bumpedMaxPriorityFeePerGas: "0x" + attemptMaxPriority.toString(16),
            });
          } else {
            // 힌트가 없으면 기준 fee를 20%+1wei로 올림
            attemptMaxFee = (attemptMaxFee * 12n) / 10n + 1n;
            attemptMaxPriority = (attemptMaxPriority * 12n) / 10n + 1n;
          }

          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }

        throw new Error(`Bundler error: ${msg}`);
      }

      // UserOp 제출 성공 - 더 이상 retry하지 않음
      userOpHashFromBundler = bundlerResult.result;
      console.log("UserOp submitted successfully:", userOpHashFromBundler);
      
      // confirmation 대기
      txHash = await waitForTransaction(paymasterUrl, userOpHashFromBundler);
      
      // txHash가 있든 없든 루프 종료 (이미 mempool에 들어간 상태)
      break;
    }

    if (!userOpHashFromBundler) {
      throw new Error(`Bundler error: ${lastBundlerError || "Unknown bundler error"}`);
    }

    // txHash가 없어도 userOpHash가 있으면 성공으로 처리 (mempool에 pending)
    // 대부분의 경우 txHash가 있지만, bundler 지연으로 없을 수 있음
    let txHashType: "transaction" | "userOp" | "none" = "none";
    if (!txHash && userOpHashFromBundler) {
      console.log("UserOp pending in mempool, proceeding without txHash");
      txHash = userOpHashFromBundler; // userOpHash를 임시 식별자로 사용
      txHashType = "userOp";
    } else if (txHash) {
      txHashType = "transaction";
    }

    if (!txHash) {
      throw new Error(lastBundlerError || "Transaction not confirmed within timeout");
    }

    // DB 업데이트 (special_votes 테이블에 tx_hash 기록)
    // eventId는 프론트에서 전달한 special_votes 레코드의 id
    if (eventId && txHash) {
      await supabase
        .from("special_votes")
        .update({ tx_hash: txHash })
        .eq("id", eventId);
    }

    console.log("=== record-onchain-vote completed ===", { txHash, txHashType, voterAddress });

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        txHashType,
        userOpHash: userOpHashFromBundler || null,
        voterAddress,
        backendSmartAccount: BACKEND_SMART_ACCOUNT,
        artistHash,
        voteCount,
        voteContractAddress,
        dauContractAddress: dauContractAddress || null,
        entryPoint: ENTRY_POINT_ADDRESS,
        _version: VERSION,
        _deployedAt: DEPLOYED_AT,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in record-onchain-vote:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        _version: VERSION,
        _deployedAt: DEPLOYED_AT,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// UserOperation 해시 계산 헬퍼
async function calculateUserOpHash(
  userOp: any,
  entryPoint: string,
  chainId: bigint
): Promise<string> {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );

  const userOpHashInner = ethers.keccak256(packed);

  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [userOpHashInner, entryPoint, chainId]
    )
  );
}

// 트랜잭션 확인 대기 헬퍼
async function waitForTransaction(paymasterUrl: string, userOpHash: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      }),
    });

    const result = await response.json();
    if (result?.error) {
      // NOTE: Coinbase endpoint가 eth_getUserOperationReceipt를 지원하지 않거나, 아직 준비가 안 됐을 때 원인 파악용
      console.warn("UserOp receipt error:", JSON.stringify(result.error).slice(0, 300));
    }
    if (result.result?.receipt?.transactionHash) {
      return result.result.receipt.transactionHash;
    }
  }

  console.warn("Transaction not confirmed within timeout");
  return "";
}
