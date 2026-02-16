import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// 미청구 상금 회수 및 다음 챌린지 적립 처리
// 매일 실행하여 claim_end_time이 지난 챌린지의 미청구 상금을 처리

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // 1. claim_end_time이 지난 챌린지 중 처리되지 않은 것 조회
    const { data: expiredChallenges, error: fetchError } = await supabase
      .from('challenges')
      .select('id, total_prize_usdc, wiki_entry_id, claim_end_time')
      .lt('claim_end_time', now)
      .eq('status', 'active')
      .is('selection_tx_hash', null) // 아직 회수 처리 안됨 (selection_tx_hash를 회수 처리 마커로 재사용)
      .not('admin_approved_at', 'is', null); // 승인된 챌린지만

    if (fetchError) {
      console.error('Error fetching expired challenges:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredChallenges?.length || 0} expired challenges to process`);

    const results: any[] = [];

    for (const challenge of expiredChallenges || []) {
      try {
        // 2. 해당 챌린지의 미청구 당첨자 조회
        const { data: unclaimedWinners, error: winnersError } = await supabase
          .from('challenge_participations')
          .select('id, user_id, prize_amount')
          .eq('challenge_id', challenge.id)
          .eq('is_winner', true)
          .is('claimed_at', null);

        if (winnersError) {
          console.error(`Error fetching unclaimed winners for ${challenge.id}:`, winnersError);
          continue;
        }

        // 3. 미청구 상금 합계 계산
        const unclaimedTotal = (unclaimedWinners || []).reduce(
          (sum, w) => sum + (w.prize_amount || 0),
          0
        );

        console.log(`Challenge ${challenge.id}: ${unclaimedWinners?.length || 0} unclaimed winners, total: $${unclaimedTotal}`);

        if (unclaimedTotal > 0) {
          // 4. 다음 활성 챌린지 찾기 (같은 wiki_entry 우선, 없으면 아무거나)
          let nextChallengeId: string | null = null;

          // 같은 wiki_entry의 다음 챌린지 찾기
          if (challenge.wiki_entry_id) {
            const { data: sameChallenges } = await supabase
              .from('challenges')
              .select('id')
              .eq('wiki_entry_id', challenge.wiki_entry_id)
              .eq('status', 'active')
              .gt('end_time', now)
              .neq('id', challenge.id)
              .order('start_time', { ascending: true })
              .limit(1);

            if (sameChallenges && sameChallenges.length > 0) {
              nextChallengeId = sameChallenges[0].id;
            }
          }

          // 같은 wiki_entry 챌린지가 없으면 아무 활성 챌린지
          if (!nextChallengeId) {
            const { data: anyChallenges } = await supabase
              .from('challenges')
              .select('id')
              .eq('status', 'active')
              .gt('end_time', now)
              .neq('id', challenge.id)
              .order('start_time', { ascending: true })
              .limit(1);

            if (anyChallenges && anyChallenges.length > 0) {
              nextChallengeId = anyChallenges[0].id;
            }
          }

          if (nextChallengeId) {
            // 5. 다음 챌린지의 total_prize_usdc 증가
            const { data: nextChallenge } = await supabase
              .from('challenges')
              .select('total_prize_usdc')
              .eq('id', nextChallengeId)
              .single();

            if (nextChallenge) {
              const newPrize = (nextChallenge.total_prize_usdc || 0) + unclaimedTotal;
              
              await supabase
                .from('challenges')
                .update({ total_prize_usdc: newPrize })
                .eq('id', nextChallengeId);

              console.log(`Added $${unclaimedTotal} to next challenge ${nextChallengeId}`);
            }
          } else {
            console.log(`No next challenge found, unclaimed $${unclaimedTotal} will remain`);
          }

          // 6. 미청구 당첨자들을 '미청구로 종료'로 표시
          await supabase
            .from('challenge_participations')
            .update({ 
              claimed_at: now, 
              tx_hash: 'expired_unclaimed' 
            })
            .eq('challenge_id', challenge.id)
            .eq('is_winner', true)
            .is('claimed_at', null);

          results.push({
            challengeId: challenge.id,
            unclaimedWinners: unclaimedWinners?.length || 0,
            unclaimedTotal,
            nextChallengeId,
            status: 'processed',
          });
        } else {
          results.push({
            challengeId: challenge.id,
            unclaimedWinners: 0,
            unclaimedTotal: 0,
            status: 'no_unclaimed',
          });
        }

        // 7. 챌린지 상태 업데이트 (처리 완료 마킹)
        await supabase
          .from('challenges')
          .update({ 
            status: 'completed',
            selection_tx_hash: `expired_processed_${now}` 
          })
          .eq('id', challenge.id);

      } catch (challengeError: any) {
        console.error(`Error processing challenge ${challenge.id}:`, challengeError);
        results.push({
          challengeId: challenge.id,
          status: 'error',
          error: challengeError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error processing expired claims:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
