import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * QuestN API-based template 호환 Edge Function
 * 
 * QuestN이 호출하는 형식:
 * GET https://k-trendz.com/api/quest-verify?address=0x...&challengeId=xxx
 * 
 * 응답 형식 (QuestN 필수):
 * { "data": { "result": true } } - 참여 완료
 * { "data": { "result": false }, "error": { "code": "...", "message": "..." } } - 미참여
 * 
 * 참고: https://questn.gitbook.io/docs/api-technical-documentation
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // QuestN은 'address' 파라미터를 사용함 (기존 'wallet'도 지원)
    const address = url.searchParams.get('address') || url.searchParams.get('wallet');
    const challengeId = url.searchParams.get('challengeId');

    console.log(`[verify-quest-participation] address: ${address}, challengeId: ${challengeId}`);

    // 지갑 주소 필수
    if (!address) {
      // QuestN 형식으로 에러 반환 (status 200 필수!)
      return new Response(
        JSON.stringify({ 
          data: { result: false },
          error: {
            code: 'MISSING_ADDRESS',
            message: 'address parameter is required'
          }
        }),
        { 
          status: 200, // QuestN은 항상 200을 요구함
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 지갑 주소 정규화 (소문자)
    const normalizedAddress = address.toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 지갑 주소로 user_id 찾기
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_addresses')
      .select('user_id')
      .ilike('wallet_address', normalizedAddress)
      .single();

    if (walletError || !walletData) {
      console.log(`[verify-quest-participation] Wallet not found: ${normalizedAddress}`);
      return new Response(
        JSON.stringify({ 
          data: { result: false },
          error: {
            code: 'WALLET_NOT_FOUND',
            message: 'This wallet is not linked to any K-Trendz account. Please link your wallet first at k-trendz.com/wallet'
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const userId = walletData.user_id;
    console.log(`[verify-quest-participation] Found user_id: ${userId}`);

    // 2. 참여 기록 조회
    let query = supabase
      .from('challenge_participations')
      .select('id, challenge_id, created_at, is_winner')
      .eq('user_id', userId);

    // challengeId가 있으면 특정 챌린지만 조회
    if (challengeId) {
      query = query.eq('challenge_id', challengeId);
    }

    const { data: participations, error: participationError } = await query
      .order('created_at', { ascending: false })
      .limit(10);

    if (participationError) {
      console.error(`[verify-quest-participation] Error fetching participations:`, participationError);
      return new Response(
        JSON.stringify({ 
          data: { result: false },
          error: {
            code: 'DB_ERROR',
            message: 'Failed to verify participation status'
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3. 결과 반환
    if (!participations || participations.length === 0) {
      console.log(`[verify-quest-participation] No participations found for user: ${userId}`);
      return new Response(
        JSON.stringify({ 
          data: { result: false },
          error: {
            code: 'NO_PARTICIPATION',
            message: challengeId 
              ? 'User has not participated in this challenge yet'
              : 'User has not participated in any challenge yet'
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 참여 기록이 있음 - QuestN 성공 형식으로 반환
    const latestParticipation = participations[0];
    console.log(`[verify-quest-participation] Verified! Participation found:`, latestParticipation);

    return new Response(
      JSON.stringify({ 
        data: { 
          result: true,
          // 추가 정보 (QuestN에서 사용하지 않지만 디버깅용)
          participatedAt: latestParticipation.created_at,
          challengeId: latestParticipation.challenge_id,
          isWinner: latestParticipation.is_winner,
          totalParticipations: participations.length
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verify-quest-participation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        data: { result: false },
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage
        }
      }),
      { 
        status: 200, // QuestN은 항상 200을 요구함
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
