import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 퀴즈쇼 상금을 DB USDC 잔액으로 추가 (온체인 전송 없음)
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId, userId } = await req.json();
    
    console.log('Claiming prize to DB balance:', { challengeId, userId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 참여 정보 확인
    const { data: participation, error: partError } = await supabase
      .from('challenge_participations')
      .select('*, challenges!inner(options, question)')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();

    if (partError || !participation) {
      throw new Error('Participation not found');
    }

    if (!participation.is_winner) {
      throw new Error('Not a winner');
    }

    if (participation.claimed_at) {
      throw new Error('Already claimed');
    }

    const prizeAmount = participation.prize_amount;
    if (!prizeAmount || prizeAmount <= 0) {
      throw new Error('Invalid prize amount');
    }

    console.log('Prize amount:', prizeAmount);

    // 1. USDC 잔액 업데이트 (upsert)
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
          balance: existingBalance.balance + prizeAmount 
        })
        .eq('user_id', userId);

      if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`);
    } else {
      // 새 잔액 생성
      const { error: insertError } = await supabase
        .from('usdc_balances')
        .insert({ 
          user_id: userId, 
          balance: prizeAmount 
        });

      if (insertError) throw new Error(`Failed to create balance: ${insertError.message}`);
    }

    // 2. USDC 트랜잭션 기록
    const { error: txError } = await supabase
      .from('usdc_transactions')
      .insert({
        user_id: userId,
        amount: prizeAmount,
        fee: 0,
        transaction_type: 'prize_claim',
        reference_id: challengeId,
        status: 'completed',
      });

    if (txError) {
      console.error('Failed to record transaction:', txError);
      // 트랜잭션 기록 실패해도 진행 (잔액은 이미 추가됨)
    }

    // 3. 참여 정보 업데이트
    const { error: updatePartError } = await supabase
      .from('challenge_participations')
      .update({ 
        claimed_at: new Date().toISOString(),
      })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);

    if (updatePartError) {
      console.error('Failed to update participation:', updatePartError);
    }

    console.log('Prize claimed successfully to DB balance');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Prize added to your USDC balance',
        data: {
          prizeAmount,
          challengeQuestion: participation.challenges?.question,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error claiming prize:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
