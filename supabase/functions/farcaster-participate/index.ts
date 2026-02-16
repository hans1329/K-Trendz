import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@6.13.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FanzToken V5 컨트랙트 정보
const FANZTOKEN_V5_ADDRESS = '0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7';
const FANZTOKEN_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

// 현재 활성화된 토큰 ID들
const ACTIVE_TOKEN_IDS = [
  BigInt('12666454296509763493'), // K-Trendz Supporters
  BigInt('7963681970480434413'),  // RIIZE
  BigInt('4607865675402095874'),  // IVE
];

// 온체인에서 응원봉 보유 여부 확인
async function checkOnchainLightstick(walletAddress: string): Promise<boolean> {
  try {
    const rpcUrl = Deno.env.get('ALCHEMY_BASE_RPC_URL') || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(FANZTOKEN_V5_ADDRESS, FANZTOKEN_ABI, provider);

    // 모든 토큰 ID에 대해 잔액 확인
    for (const tokenId of ACTIVE_TOKEN_IDS) {
      const balance = await contract.balanceOf(walletAddress, tokenId);
      if (balance > 0n) {
        console.log(`[farcaster-participate] Onchain lightstick found: tokenId=${tokenId}, balance=${balance}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[farcaster-participate] Onchain balance check failed:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { challengeId, answer, fid, username, displayName, walletAddress } = body;

    console.log('[farcaster-participate] Request:', { challengeId, answer, fid, username });

    if (!challengeId || !answer || !fid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: challengeId, answer, fid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 챌린지 확인 (연결된 wiki_entry_id도 조회)
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select(`
        id, status, end_time,
        challenge_wiki_entries(wiki_entry_id)
      `)
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 연결된 wiki_entry_id 추출
    const linkedWikiEntryIds = (challenge.challenge_wiki_entries || []).map((e: any) => e.wiki_entry_id);

    // 챌린지 상태 확인 (active 또는 test만 허용)
    if (challenge.status !== 'active' && challenge.status !== 'test') {
      return new Response(
        JSON.stringify({ error: 'This challenge is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 종료 시간 확인
    const now = new Date();
    const endTime = new Date(challenge.end_time);
    if (now > endTime) {
      return new Response(
        JSON.stringify({ error: 'This challenge has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FID 기반 밴 체크 (linked_user_id가 있는 경우)
    const { data: existingExternalUser } = await supabase
      .from('external_wallet_users')
      .select('linked_user_id')
      .eq('fid', fid)
      .eq('source', 'farcaster')
      .maybeSingle();

    if (existingExternalUser?.linked_user_id) {
      const { data: userBan } = await supabase
        .from('user_bans')
        .select('id')
        .eq('user_id', existingExternalUser.linked_user_id)
        .maybeSingle();

      if (userBan) {
        console.log(`[farcaster-participate] Banned linked user attempted to participate: ${existingExternalUser.linked_user_id}`);
        return new Response(
          JSON.stringify({ error: 'Your account has been suspended' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 외부 지갑 사용자 조회 또는 생성 (FID 기준)
    let externalWalletUser;
    const { data: existingUser } = await supabase
      .from('external_wallet_users')
      .select('*')
      .eq('fid', fid)
      .eq('source', 'farcaster')
      .single();

    if (existingUser) {
      externalWalletUser = existingUser;
      
      // 지갑 주소가 변경되었으면 업데이트
      if (walletAddress && existingUser.wallet_address !== walletAddress) {
        await supabase
          .from('external_wallet_users')
          .update({ 
            wallet_address: walletAddress,
            username: username || existingUser.username,
            display_name: displayName || existingUser.display_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);
      }
    } else {
      // 새 사용자 생성
      const { data: newUser, error: createError } = await supabase
        .from('external_wallet_users')
        .insert({
          fid,
          wallet_address: walletAddress || `fid:${fid}`,
          username,
          display_name: displayName,
          source: 'farcaster'
        })
        .select()
        .single();

      if (createError) {
        console.error('[farcaster-participate] Create user error:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      externalWalletUser = newUser;
    }

    // 이미 참여했는지 확인
    const { data: existingParticipation } = await supabase
      .from('external_challenge_participations')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('external_wallet_id', externalWalletUser.id)
      .single();

    if (existingParticipation) {
      console.log('[farcaster-participate] Already participated:', { challengeId, fid, externalWalletId: externalWalletUser.id });
      return new Response(
        JSON.stringify({ 
          error: 'Already participated',
          message: 'You have already submitted an answer for this challenge'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // linked_user_id가 있으면 K-Trendz 계정으로 참여했는지도 확인
    if (externalWalletUser.linked_user_id) {
      const { data: linkedParticipation } = await supabase
        .from('challenge_participations')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('user_id', externalWalletUser.linked_user_id)
        .single();

      if (linkedParticipation) {
        return new Response(
          JSON.stringify({ 
            error: 'Already participated via K-Trendz',
            message: 'You already entered this challenge with your K-Trendz account'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 응원봉 보유 여부 확인
    // 1) linked_user_id가 있으면 K-Trendz DB에서 fanz_balances 조회
    // 2) 없으면 외부 지갑 주소로 온체인 잔액 확인
    let hasLightstick = false;

    if (externalWalletUser.linked_user_id) {
      // K-Trendz 계정과 연결된 경우 - DB에서 응원봉 잔액 조회
      if (linkedWikiEntryIds.length === 0) {
        // 아무 아티스트도 선택 안됨 = 모든 응원봉 보유자 대상
        const { data: fanzBalanceData } = await supabase
          .from('fanz_balances')
          .select('balance')
          .eq('user_id', externalWalletUser.linked_user_id)
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
            .eq('user_id', externalWalletUser.linked_user_id)
            .in('fanz_token_id', fanzTokenIds)
            .gt('balance', 0)
            .limit(1);
          
          hasLightstick = !!(fanzBalanceData && fanzBalanceData.length > 0);
        }
      }
      console.log(`[farcaster-participate] Lightstick check via linked_user_id: ${hasLightstick}`);
    } else if (walletAddress && !walletAddress.startsWith('fid:')) {
      // 외부 지갑만 있는 경우 - 온체인에서 직접 잔액 확인
      hasLightstick = await checkOnchainLightstick(walletAddress);
      console.log(`[farcaster-participate] Onchain lightstick check for ${walletAddress}: ${hasLightstick}`);
    }

    console.log(`[farcaster-participate] User lightstick status: ${hasLightstick} (linked: ${!!externalWalletUser.linked_user_id})`);

    // 참여 기록 저장 (has_lightstick 포함)
    const { error: insertError } = await supabase
      .from('external_challenge_participations')
      .insert({
        challenge_id: challengeId,
        external_wallet_id: externalWalletUser.id,
        answer: answer,
        has_lightstick: hasLightstick
      });

    if (insertError) {
      console.error('[farcaster-participate] Insert participation error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record participation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[farcaster-participate] Success:', { 
      challengeId, 
      externalWalletId: externalWalletUser.id,
      answer,
      hasLightstick
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Entry submitted! Winners will be announced after the challenge ends.',
        hasLightstick
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[farcaster-participate] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});