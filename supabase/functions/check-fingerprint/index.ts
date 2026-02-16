import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fingerprint, action, challengeId } = await req.json();

    if (!fingerprint) {
      return new Response(
        JSON.stringify({ error: 'Fingerprint is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-fingerprint] Action: ${action}, Fingerprint: ${fingerprint.substring(0, 8)}...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'check') {
      // IP 가입 제한 설정 확인
      const { data: settingData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'ip_signup_limit_enabled')
        .maybeSingle();

      const isLimitEnabled = settingData?.setting_value?.enabled !== false; // 기본값: 활성화

      if (!isLimitEnabled) {
        console.log('[check-fingerprint] IP signup limit is disabled, allowing');
        return new Response(
          JSON.stringify({ allowed: true, reason: 'ip_limit_disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 24시간 내 동일 fingerprint로 가입 여부 체크
      const { data, error } = await supabase.rpc('check_fingerprint_limit', {
        p_fingerprint: fingerprint,
        p_window_hours: 24
      });

      if (error) {
        console.error('[check-fingerprint] Error checking fingerprint:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to check fingerprint' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[check-fingerprint] Check result:`, data);
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check_challenge') {
      // 챌린지 참여용: 24시간 내 동일 fingerprint로 3회 제한
      if (!challengeId) {
        return new Response(
          JSON.stringify({ error: 'challengeId is required for check_challenge action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ip_rate_limits 테이블 활용 (fingerprint를 ip_hash 대신 사용)
      const { data, error } = await supabase.rpc('check_ip_rate_limit', {
        p_ip_hash: `fp_${fingerprint}`, // fingerprint에 prefix 추가하여 IP hash와 구분
        p_action_type: 'challenge_participation',
        p_reference_id: challengeId,
        p_max_attempts: 3,
        p_window_hours: 24
      });

      if (error) {
        console.error('[check-fingerprint] Error checking challenge fingerprint:', error);
        // rate limit 체크 실패 시 통과 (fail-open)
        return new Response(
          JSON.stringify({ allowed: true, attempts: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[check-fingerprint] Challenge check result for ${challengeId}:`, data);
      return new Response(
        JSON.stringify({
          allowed: data.allowed,
          attempts: data.attempts || 0,
          message: data.allowed ? undefined : 'You can only participate 3 times per challenge every 24 hours from this device.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'save') {
      // 가입 후 fingerprint 저장
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 사용자 인증 확인
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.error('[check-fingerprint] Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // fingerprint 저장
      const { error: saveError } = await supabase.rpc('save_user_fingerprint', {
        p_user_id: user.id,
        p_fingerprint: fingerprint
      });

      if (saveError) {
        console.error('[check-fingerprint] Error saving fingerprint:', saveError);
        return new Response(
          JSON.stringify({ error: 'Failed to save fingerprint' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[check-fingerprint] Saved fingerprint for user: ${user.id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'record_challenge') {
      // 챌린지 참여 후 fingerprint 기록 (rate limit용)
      if (!challengeId) {
        return new Response(
          JSON.stringify({ error: 'challengeId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ip_rate_limits 테이블에 기록
      const { error: insertError } = await supabase
        .from('ip_rate_limits')
        .insert({
          ip_hash: `fp_${fingerprint}`,
          action_type: 'challenge_participation',
          reference_id: challengeId
        });

      if (insertError) {
        console.error('[check-fingerprint] Error recording challenge fingerprint:', insertError);
        // 기록 실패해도 무시 (참여는 성공)
      } else {
        console.log(`[check-fingerprint] Recorded challenge participation for fingerprint: ${fingerprint.substring(0, 8)}...`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'ban_duplicate') {
      // 중복 가입 감지 시 자동 차단
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // user_bans 테이블에 추가
      const { error: banError } = await supabase
        .from('user_bans')
        .insert({
          user_id: user.id,
          reason: `Duplicate signup detected - fingerprint: ${fingerprint.substring(0, 8)}...`,
          banned_by: user.id // 시스템 자동 차단
        });

      if (banError && !banError.message.includes('duplicate')) {
        console.error('[check-fingerprint] Error banning user:', banError);
      } else {
        console.log(`[check-fingerprint] User banned for duplicate signup: ${user.id}`);
      }

      return new Response(
        JSON.stringify({ success: true, banned: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-fingerprint] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
