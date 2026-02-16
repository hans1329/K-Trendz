import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 답변을 숫자로 변환하는 함수
function parseAnswerToNumber(answer: string): string {
  if (!answer) return '';
  
  // 이미 순수 숫자인 경우
  if (/^[0-9]+$/.test(answer)) {
    return answer;
  }
  
  let cleaned = answer.trim();
  
  // 콤마만 있는 숫자 (예: 1,367,600)
  if (/^[0-9,]+$/.test(cleaned)) {
    return cleaned.replace(/,/g, '');
  }
  
  // 소수점이 있는 숫자 (예: 660.500)
  if (/^[0-9.]+$/.test(cleaned)) {
    return String(Math.round(parseFloat(cleaned)));
  }
  
  // k/K 단위 (예: 800k)
  const kMatch = cleaned.match(/^([0-9.]+)\s*[kK]$/);
  if (kMatch) {
    return String(Math.round(parseFloat(kMatch[1]) * 1000));
  }
  
  // million/m/M 단위 (예: 3 million, 1M)
  const mMatch = cleaned.match(/^([0-9.]+)\s*(million|m)$/i);
  if (mMatch) {
    return String(Math.round(parseFloat(mMatch[1]) * 1000000));
  }
  
  // 숫자만 추출 (예: "3 million views" -> "3000000")
  const numWithUnit = cleaned.match(/^([0-9.]+)\s*(million|m)/i);
  if (numWithUnit) {
    return String(Math.round(parseFloat(numWithUnit[1]) * 1000000));
  }
  
  // 그 외: 숫자만 추출
  const digits = cleaned.replace(/[^0-9]/g, '');
  return digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 관리자 권한 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { challengeId } = await req.json();

    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Challenge ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 해당 챌린지의 모든 참여 답변 가져오기
    const { data: participations, error: fetchError } = await supabase
      .from('challenge_participations')
      .select('id, answer')
      .eq('challenge_id', challengeId);

    if (fetchError) throw fetchError;

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of participations || []) {
      const original = p.answer;
      
      // 이미 순수 숫자면 스킵
      if (/^[0-9]+$/.test(original)) {
        skipped++;
        continue;
      }

      const converted = parseAnswerToNumber(original);
      
      if (converted && converted !== original) {
        const { error: updateError } = await supabase
          .from('challenge_participations')
          .update({ answer: converted })
          .eq('id', p.id);

        if (updateError) {
          errors.push(`Failed to update ${p.id}: ${updateError.message}`);
        } else {
          updated++;
          console.log(`Converted: "${original}" -> "${converted}"`);
        }
      } else if (!converted) {
        console.log(`Could not convert: "${original}"`);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: participations?.length || 0,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-challenge-answers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
