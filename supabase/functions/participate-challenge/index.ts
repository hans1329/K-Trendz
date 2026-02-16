import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6.15.0';
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
};

// DAU 기록용 활동 타입
const ACTIVITY_CHALLENGE = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// DAU 기록 헬퍼 함수 (백그라운드 실행)
async function recordDAUChallenge(
  userId: string,
  challengeId: string,
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
    // 사용자 지갑 주소 조회 (여러 지갑 중 첫 번째 사용)
    const { data: walletRows } = await supabase
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", userId)
      .eq("network", "base")
      .limit(1);
    const walletAddress = walletRows?.[0]?.wallet_address;

    if (!walletAddress) {
      console.log("DAU recording skipped - no wallet for user", userId);
      return;
    }

    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const ownerWallet = new ethers.Wallet(operatorPrivateKey, provider);

    const referenceHash = ethers.keccak256(ethers.solidityPacked(['string'], [challengeId]));

    // DAU calldata
    const dauInterface = new ethers.Interface([
      "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
    ]);
    const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
      walletAddress,
      ACTIVITY_CHALLENGE,
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

    // 유니크 nonce key 생성 (nonce 충돌 방지)
    const walletLower = BigInt(walletAddress) & ((1n << 128n) - 1n);
    const timestampPart = BigInt(Date.now()) & ((1n << 64n) - 1n);
    const nonceKey = (walletLower << 64n) | timestampPart;

    // nonce 조회
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ]);
    const nonceData = await provider.call({
      to: ENTRY_POINT_ADDRESS,
      data: entryPointInterface.encodeFunctionData("getNonce", [BACKEND_SMART_ACCOUNT, nonceKey]),
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
      callGasLimit: "0x7a120",        // 500,000 (vote와 동일)
      verificationGasLimit: "0x7a120", // 500,000
      preVerificationGas: "0x186a0",   // 100,000
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
    if (pmResult.result?.callGasLimit) userOp.callGasLimit = pmResult.result.callGasLimit;
    if (pmResult.result?.verificationGasLimit) userOp.verificationGasLimit = pmResult.result.verificationGasLimit;
    if (pmResult.result?.preVerificationGas) userOp.preVerificationGas = pmResult.result.preVerificationGas;

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

    console.log("DAU challenge activity recorded for:", userId);
  } catch (e) {
    console.error("DAU recording error:", e);
  }
}

// IP 주소를 해시화하는 함수
async function hashIP(ip: string): Promise<string> {
  const salt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 16) || '';
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 클라이언트 IP 추출
function getClientIP(req: Request): string {
  // Cloudflare, Nginx 등 프록시 헤더 확인
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 클라이언트 IP 추출 및 해시화
    const clientIP = getClientIP(req);
    const ipHash = await hashIP(clientIP);
    console.log(`Request from IP hash: ${ipHash.slice(0, 16)}...`);

    // 화이트리스트 IP (테스트/개발용 예외)
    const WHITELISTED_IP_HASHES = new Set([
      '12a9018e87448c4f82b65938a4d44c09f3af7ed7b0585d69ccafe1c614c0c7d0', // admin/dev IP
    ]);
    const isWhitelisted = WHITELISTED_IP_HASHES.has(ipHash);
    if (isWhitelisted) {
      console.log('IP is whitelisted, skipping rate limit checks');
    }

    // 사용자 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 밴된 유저 체크
    const { data: userBan } = await supabase
      .from('user_bans')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userBan) {
      console.log(`Banned user ${user.id} attempted to participate`);
      return new Response(JSON.stringify({ error: 'Your account has been suspended' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { challengeId, answer, fingerprint } = await req.json();

    if (!challengeId || !answer) {
      return new Response(JSON.stringify({ error: 'Missing challengeId or answer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IP Rate Limiting 체크 (챌린지당 IP별 24시간 내 3회 제한) - 화이트리스트면 스킵
    if (!isWhitelisted) {
      const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
        'check_ip_rate_limit',
        {
          p_ip_hash: ipHash,
          p_action_type: 'challenge_participation',
          p_reference_id: challengeId,
          p_max_attempts: 3,
          p_window_hours: 24
        }
      );

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError);
        // Rate limit 체크 실패 시에도 계속 진행 (fail-open)
      } else if (rateLimitResult && !rateLimitResult.allowed) {
        console.log(`Rate limit exceeded for IP hash ${ipHash.slice(0, 16)}... on challenge ${challengeId}`);

        // NOTE:
        // - supabase-js/functions-js는 non-2xx(예: 429)를 FunctionsHttpError로 처리하며,
        //   일부 환경에서는 이게 "Edge function returned 429" 런타임 에러/블랭크 스크린로 보일 수 있음.
        // - 그래서 여기서는 200으로 내려주고 payload의 code로 rate limit을 표현한다.
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Too many participation attempts from this network. Please try again later.',
            code: 'RATE_LIMITED',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else if (rateLimitResult) {
        console.log(`IP rate limit check passed: ${rateLimitResult.attempts}/${rateLimitResult.max_attempts} attempts`);
      }

      // Fingerprint 기반 체크 (VPN 우회 방지)
      if (fingerprint) {
        // 1. 먼저 쿨다운 체크 (5분) - rate limit RPC 호출 전에 수행
        const COOLDOWN_MINUTES = 5;
        const { data: lastParticipation } = await supabase
          .from('ip_rate_limits')
          .select('created_at')
          .eq('ip_hash', `fp_${fingerprint}`)
          .eq('action_type', 'challenge_participation')
          .eq('reference_id', challengeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastParticipation) {
          const lastTime = new Date(lastParticipation.created_at);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastTime.getTime()) / (1000 * 60);
          
          if (diffMinutes < COOLDOWN_MINUTES) {
            console.log(`Cooldown active for fp_${fingerprint.slice(0, 8)}...: ${Math.ceil((COOLDOWN_MINUTES - diffMinutes) * 60)}s remaining`);
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Please try again later.',
                code: 'COOLDOWN',
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // 2. 그 다음 Rate Limiting 체크 (24시간 내 3회 제한)
        const { data: fpRateLimitResult, error: fpRateLimitError } = await supabase.rpc(
          'check_ip_rate_limit',
          {
            p_ip_hash: `fp_${fingerprint}`,
            p_action_type: 'challenge_participation',
            p_reference_id: challengeId,
            p_max_attempts: 3,
            p_window_hours: 24
          }
        );

        if (fpRateLimitError) {
          console.error('Fingerprint rate limit check error:', fpRateLimitError);
        } else if (fpRateLimitResult && !fpRateLimitResult.allowed) {
          console.log(`Fingerprint rate limit exceeded for fp_${fingerprint.slice(0, 8)}... on challenge ${challengeId}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Too many participation attempts from this device. Please try again later.',
              code: 'RATE_LIMITED',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else if (fpRateLimitResult) {
          console.log(`Fingerprint rate limit check passed: ${fpRateLimitResult.attempts}/${fpRateLimitResult.max_attempts} attempts`);
        }
      }
    }

    // 유저 계정 기준 참여 횟수 제한 (챌린지당 최대 3회)
    const MAX_ENTRIES_PER_USER = 3;
    const { count: userEntryCount, error: countError } = await supabase
      .from('challenge_participations')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    if (!countError && (userEntryCount ?? 0) >= MAX_ENTRIES_PER_USER) {
      console.log(`User ${user.id} reached max entries (${userEntryCount}/${MAX_ENTRIES_PER_USER}) for challenge ${challengeId}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `You have reached the maximum of ${MAX_ENTRIES_PER_USER} entries for this challenge.`,
          code: 'MAX_ENTRIES_REACHED',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 챌린지 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, entry_cost, start_time, end_time, status')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error('Challenge not found:', challengeError);
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 챌린지에 연결된 wiki_entry_ids 조회
    const { data: challengeWikiEntries } = await supabase
      .from('challenge_wiki_entries')
      .select('wiki_entry_id')
      .eq('challenge_id', challengeId);

    const linkedWikiEntryIds = challengeWikiEntries?.map(e => e.wiki_entry_id) || [];
    console.log(`Challenge ${challengeId} linked wiki entries:`, linkedWikiEntryIds);

    // 서버 측에서 응원봉 보유 여부 확인
    let hasLightstick = false;
    
    if (linkedWikiEntryIds.length === 0) {
      // 아무 아티스트도 선택 안됨 = 모든 응원봉 보유자 대상
      const { data: fanzBalanceData } = await supabase
        .from('fanz_balances')
        .select('balance')
        .eq('user_id', user.id)
        .gt('balance', 0)
        .limit(1);
      
      hasLightstick = !!(fanzBalanceData && fanzBalanceData.length > 0);
    } else {
      // 특정 아티스트 선택 = 해당 아티스트의 응원봉만 체크
      const { data: fanzTokens } = await supabase
        .from('fanz_tokens')
        .select('id')
        .in('wiki_entry_id', linkedWikiEntryIds);
      
      const fanzTokenIds = fanzTokens?.map(t => t.id) || [];
      
      if (fanzTokenIds.length > 0) {
        const { data: fanzBalanceData } = await supabase
          .from('fanz_balances')
          .select('balance')
          .eq('user_id', user.id)
          .in('fanz_token_id', fanzTokenIds)
          .gt('balance', 0)
          .limit(1);
        
        hasLightstick = !!(fanzBalanceData && fanzBalanceData.length > 0);
      }
    }
    
    console.log(`User ${user.id} lightstick status: ${hasLightstick} (linked entries: ${linkedWikiEntryIds.length})`);

    // 챌린지 상태 확인
    const now = new Date();
    const startTime = new Date(challenge.start_time);
    const endTime = new Date(challenge.end_time);

    if (now < startTime) {
      return new Response(JSON.stringify({ error: 'Challenge has not started yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (now > endTime) {
      return new Response(JSON.stringify({ error: 'Challenge has ended' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entryCost = challenge.entry_cost || 0;

    // 참여 비용이 있으면 포인트 차감
    if (entryCost > 0) {
      // 현재 포인트 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('available_points')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile not found:', profileError);
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (profile.available_points < entryCost) {
        return new Response(JSON.stringify({ 
          error: `Not enough Stars. You need ${entryCost} Stars to participate.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 포인트 차감 (service_role로 실행되므로 트리거 우회)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ available_points: profile.available_points - entryCost })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to deduct points:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to deduct points' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 트랜잭션 기록
      const { error: txError } = await supabase.from('point_transactions').insert({
        user_id: user.id,
        action_type: 'challenge_entry',
        points: -entryCost,
        reference_id: challengeId,
      });

      if (txError) {
        console.error('Failed to record transaction:', txError);
        // 실패해도 계속 진행 (참여는 성공시킴)
      }
    }

    // 참여 기록 저장 (서버에서 확인한 hasLightstick 사용)
    const { data: participation, error: participationError } = await supabase
      .from('challenge_participations')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        answer: answer.trim(),
        has_lightstick: hasLightstick,
      })
      .select()
      .single();

    if (participationError) {
      console.error('Failed to create participation:', participationError);
      
      // 참여 실패 시 포인트 환불
      if (entryCost > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('available_points')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          await supabase
            .from('profiles')
            .update({ available_points: profile.available_points + entryCost })
            .eq('id', user.id);
          
          await supabase.from('point_transactions').insert({
            user_id: user.id,
            action_type: 'challenge_entry_refund',
            points: entryCost,
            reference_id: challengeId,
          });
        }
      }

      return new Response(JSON.stringify({ error: participationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Participation created:', participation.id);
    
    // 온체인 참여 기록은 챌린지 마감 후 당첨자 선정 시 일괄 batchParticipate()로 처리
    // (가스비 절감을 위해 개별 기록 대신 배치 방식 사용)
    
    // Note: fingerprint rate limit 기록은 check_ip_rate_limit RPC에서 이미 처리됨
    // (check_ip_rate_limit 함수가 체크와 동시에 기록을 생성함)

    // DAU 기록 (백그라운드 - 실패해도 메인 응답에 영향 없음)
    recordDAUChallenge(user.id, challengeId, supabase).catch(e =>
      console.error("DAU background error:", e)
    );

    return new Response(JSON.stringify({ 
      success: true, 
      participation,
      pointsDeducted: entryCost 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Participate challenge error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
