import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Galxe REST Credential 호환 Edge Function
 * 
 * Galxe가 호출하는 형식:
 * GET https://k-trendz.com/api/galxe-verify?address=0x...&challengeId=xxx
 * 
 * 응답 형식 (Galxe REST Credential 필수):
 * 1 - 참여 완료 (eligible)
 * 0 - 미참여 (not eligible)
 * 
 * 검증 범위:
 * - K-Trendz 내부 유저 (wallet_addresses → challenge_participations)
 * - Farcaster 외부 유저 (external_wallet_users → external_challenge_participations)
 * 
 * 참고: https://docs.galxe.com/quest/credential-api/rest-cred/introduction
 */
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Galxe는 '$address' placeholder를 사용하여 지갑 주소를 전달
    const address = url.searchParams.get('address');
    const challengeId = url.searchParams.get('challengeId');

    console.log(`[verify-galxe] address: ${address}, challengeId: ${challengeId}`);

    // 지갑 주소와 challengeId 둘 다 필수
    if (!address || !challengeId) {
      console.log('[verify-galxe] Missing required params');
      return new Response('0', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const normalizedAddress = address.toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === 경로 1: K-Trendz 내부 유저 검증 ===
    // wallet_addresses 테이블에서 지갑 주소로 user_id 찾기
    const { data: walletData } = await supabase
      .from('wallet_addresses')
      .select('user_id')
      .ilike('wallet_address', normalizedAddress)
      .limit(1);

    if (walletData && walletData.length > 0) {
      const userId = walletData[0].user_id;
      console.log(`[verify-galxe] K-Trendz user found: ${userId}`);

      const { data: participation } = await supabase
        .from('challenge_participations')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .limit(1);

      if (participation && participation.length > 0) {
        console.log(`[verify-galxe] ✅ K-Trendz participation verified`);
        return new Response('1', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }
    }

    // === 경로 2: Farcaster 외부 유저 검증 ===
    // external_wallet_users 테이블에서 지갑 주소로 외부 유저 찾기
    const { data: externalUsers } = await supabase
      .from('external_wallet_users')
      .select('id')
      .ilike('wallet_address', normalizedAddress)
      .limit(1);

    if (externalUsers && externalUsers.length > 0) {
      const externalWalletId = externalUsers[0].id;
      console.log(`[verify-galxe] External user found: ${externalWalletId}`);

      const { data: externalParticipation } = await supabase
        .from('external_challenge_participations')
        .select('id')
        .eq('external_wallet_id', externalWalletId)
        .eq('challenge_id', challengeId)
        .limit(1);

      if (externalParticipation && externalParticipation.length > 0) {
        console.log(`[verify-galxe] ✅ External participation verified`);
        return new Response('1', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }
    }

    // === 경로 3: linked_user_id 역방향 검증 ===
    // Farcaster 유저가 K-Trendz 계정과 연결되어 있으면
    // K-Trendz 측 참여도 확인 (그 반대도)
    if (walletData && walletData.length > 0) {
      const userId = walletData[0].user_id;
      
      // 이 유저가 연결된 외부 지갑이 있는지 확인
      const { data: linkedExternal } = await supabase
        .from('external_wallet_users')
        .select('id')
        .eq('linked_user_id', userId)
        .limit(1);

      if (linkedExternal && linkedExternal.length > 0) {
        const { data: extPart } = await supabase
          .from('external_challenge_participations')
          .select('id')
          .eq('external_wallet_id', linkedExternal[0].id)
          .eq('challenge_id', challengeId)
          .limit(1);

        if (extPart && extPart.length > 0) {
          console.log(`[verify-galxe] ✅ Linked external participation verified`);
          return new Response('1', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }
      }
    }

    // 참여 기록 없음
    console.log(`[verify-galxe] ❌ No participation found for ${normalizedAddress}`);
    return new Response('0', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verify-galxe] Unexpected error:', errorMessage);
    // Galxe는 에러시에도 0 반환
    return new Response('0', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
