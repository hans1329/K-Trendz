import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 관리자용 일괄 상금 분배 (DB 기반, 온체인 전송 없음)
// 사용자 Smart Wallet 배포 비용 없이 usdc_balances에 잔액 추가
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId, winners } = await req.json();
    
    console.log('Distributing prizes to DB balance:', { 
      challengeId, 
      winnerCount: winners?.length 
    });

    if (!challengeId) {
      throw new Error('Challenge ID required');
    }

    if (!winners || winners.length === 0) {
      throw new Error('Winners array required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 챌린지 정보 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, question, status')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error('Challenge not found');
    }

    let successCount = 0;
    let failedCount = 0;
    const failedWinners: string[] = [];
    let totalDistributed = 0;

    // 각 당첨자에게 상금 분배
    for (const winner of winners) {
      const { userId, amount, address } = winner;
      
      if (!userId || !amount || amount <= 0) {
        console.warn('Invalid winner data:', winner);
        failedCount++;
        failedWinners.push(userId || 'unknown');
        continue;
      }

      try {
        // 1. 참여 정보 확인 (복수 참여 가능하므로 .limit(1) 사용)
        const { data: participations, error: partError } = await supabase
          .from('challenge_participations')
          .select('is_winner, claimed_at, prize_amount')
          .eq('challenge_id', challengeId)
          .eq('user_id', userId)
          .eq('is_winner', true)
          .order('prize_amount', { ascending: false })
          .limit(1);

        const participation = participations?.[0];

        if (partError || !participation) {
          console.warn(`Participation not found for user ${userId}, error:`, partError);
          failedCount++;
          failedWinners.push(userId);
          continue;
        }

        if (!participation.is_winner) {
          console.warn(`User ${userId} is not a winner`);
          failedCount++;
          failedWinners.push(userId);
          continue;
        }

        if (participation.claimed_at) {
          console.warn(`User ${userId} already claimed`);
          failedCount++;
          failedWinners.push(userId);
          continue;
        }

        // 2. USDC 잔액 업데이트 (upsert)
        const { data: existingBalance, error: balanceError } = await supabase
          .from('usdc_balances')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (balanceError && balanceError.code !== 'PGRST116') {
          throw new Error(`Failed to check balance: ${balanceError.message}`);
        }

        if (existingBalance) {
          // 기존 잔액에 추가
          const { error: updateError } = await supabase
            .from('usdc_balances')
            .update({ 
              balance: existingBalance.balance + amount 
            })
            .eq('user_id', userId);

          if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`);
        } else {
          // 새 잔액 생성
          const { error: insertError } = await supabase
            .from('usdc_balances')
            .insert({ 
              user_id: userId, 
              balance: amount 
            });

          if (insertError) throw new Error(`Failed to create balance: ${insertError.message}`);
        }

        // 3. USDC 트랜잭션 기록
        const { error: txError } = await supabase
          .from('usdc_transactions')
          .insert({
            user_id: userId,
            amount: amount,
            fee: 0,
            transaction_type: 'prize_distribution',
            reference_id: challengeId,
            status: 'completed',
          });

        if (txError) {
          console.error(`Failed to record transaction for ${userId}:`, txError);
          // 트랜잭션 기록 실패해도 진행
        }

        // 4. 참여 정보 업데이트 (claimed_at 설정 - 해당 유저의 모든 참여에 적용)
        const { error: updatePartError } = await supabase
          .from('challenge_participations')
          .update({ 
            claimed_at: new Date().toISOString(),
          })
          .eq('challenge_id', challengeId)
          .eq('user_id', userId)
          .is('claimed_at', null);

        if (updatePartError) {
          console.error(`Failed to update participation for ${userId}:`, updatePartError);
        }

        successCount++;
        totalDistributed += amount;
        console.log(`Prize distributed to ${userId}: $${amount}`);

      } catch (winnerError) {
        console.error(`Error distributing to ${userId}:`, winnerError);
        failedCount++;
        failedWinners.push(userId);
      }
    }

    console.log('Distribution completed:', {
      successCount,
      failedCount,
      totalDistributed,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Prizes distributed to ${successCount} winners via DB balance`,
        data: {
          successCount,
          failedCount,
          failedWinners: failedWinners.length > 0 ? failedWinners : undefined,
          totalDistributed,
          challengeId,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error distributing prizes:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
