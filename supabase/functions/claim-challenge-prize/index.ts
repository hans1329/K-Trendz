import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization 헤더에서 사용자 토큰 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { challengeId } = await req.json();

    if (!challengeId) {
      throw new Error('Challenge ID is required');
    }

    console.log(`[claim-challenge-prize] User ${user.id} claiming prize for challenge ${challengeId}`);

    // 1. 챌린지 정보 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error('Challenge not found');
    }

    // 2. 승인 여부 확인
    if (!challenge.admin_approved_at) {
      throw new Error('Challenge winners have not been approved yet');
    }

    // 3. 클레임 기간 확인
    const now = new Date();
    const claimStart = new Date(challenge.claim_start_time);
    
    if (now < claimStart) {
      throw new Error(`Claim period has not started yet. It starts at ${claimStart.toISOString()}`);
    }

    if (challenge.claim_end_time) {
      const claimEnd = new Date(challenge.claim_end_time);
      if (now > claimEnd) {
        throw new Error('Claim period has ended');
      }
    }

    // 4. 사용자 참여 및 당첨 여부 확인
    const { data: participation, error: participationError } = await supabase
      .from('challenge_participations')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .single();

    if (participationError || !participation) {
      throw new Error('You did not participate in this challenge');
    }

    if (!participation.is_winner) {
      throw new Error('You are not a winner in this challenge');
    }

    // 5. 이미 클레임했는지 확인 (claimed_at 컬럼 사용)
    if (participation.claimed_at) {
      throw new Error('You have already claimed your prize');
    }

    // 6. 클레임 처리 - 포인트 지급
    const prizeAmount = participation.prize_amount || 0;
    
    // USDC를 포인트로 변환 (1 USDC = 100 포인트로 가정, 필요시 조정)
    const pointsToAward = Math.floor(prizeAmount * 100);

    // 사용자 포인트 증가
    const { error: pointsError } = await supabase
      .from('profiles')
      .update({
        available_points: supabase.rpc('increment_points', { x: pointsToAward }),
      })
      .eq('id', user.id);

    // RPC가 없으면 직접 업데이트
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('available_points')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const { error: updatePointsError } = await supabase
      .from('profiles')
      .update({
        available_points: (profile.available_points || 0) + pointsToAward,
      })
      .eq('id', user.id);

    if (updatePointsError) throw updatePointsError;

    // 7. 참여 기록에 클레임 시간 기록
    const { error: claimError } = await supabase
      .from('challenge_participations')
      .update({
        claimed_at: new Date().toISOString(),
      })
      .eq('id', participation.id);

    if (claimError) throw claimError;

    // 8. 포인트 트랜잭션 기록
    await supabase
      .from('point_transactions')
      .insert({
        user_id: user.id,
        action_type: 'challenge_prize_claim',
        points: pointsToAward,
        reference_id: challengeId,
      });

    // 9. 알림 생성
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'prize_claimed',
        title: 'Prize Claimed!',
        message: `You have successfully claimed ${pointsToAward} Stars ($${prizeAmount} USDC) from the challenge!`,
        reference_id: challengeId,
      });

    console.log(`[claim-challenge-prize] User ${user.id} claimed ${pointsToAward} points ($${prizeAmount} USDC)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Prize claimed successfully',
        prize: {
          usdc_amount: prizeAmount,
          points_awarded: pointsToAward,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[claim-challenge-prize] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
