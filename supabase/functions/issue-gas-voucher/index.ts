import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 사용자 인증 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 사용자 토큰으로 인증
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 소셜 로그인 확인 (Sybil 방지)
    const provider = user.app_metadata?.provider;
    const providerId = user.app_metadata?.provider_id || user.id;
    
    // google, farcaster만 허용 (email 제외)
    const allowedProviders = ['google', 'discord'];
    // Farcaster 연동 유저 확인 (external_wallet_users에 fid가 있는 경우)
    const isFarcasterUser = user.user_metadata?.fid !== undefined;
    
    if (!allowedProviders.includes(provider) && !isFarcasterUser) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Social login required. Please sign in with Google or link your Farcaster account.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 서비스 롤 클라이언트로 DB 조작
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 기존 Voucher 확인
    const { data: existingVoucher, error: voucherCheckError } = await adminClient
      .from('gas_vouchers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (voucherCheckError) {
      throw new Error(`Voucher check failed: ${voucherCheckError.message}`);
    }

    // 이미 Voucher가 있으면 반환
    if (existingVoucher) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            voucher_code: existingVoucher.voucher_code,
            daily_limit_usd: existingVoucher.daily_limit_usd,
            is_active: existingVoucher.is_active,
            created_at: existingVoucher.created_at,
            expires_at: existingVoucher.expires_at,
            last_used_at: existingVoucher.last_used_at,
            already_exists: true
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // auth_provider 및 auth_provider_id 결정
    let authProvider: string;
    let authProviderId: string;

    if (isFarcasterUser) {
      authProvider = 'farcaster';
      authProviderId = String(user.user_metadata.fid);
    } else {
      authProvider = provider;
      authProviderId = providerId;
    }

    // 동일 소셜 계정으로 이미 발급된 Voucher 확인 (Sybil 방지)
    const { data: duplicateCheck } = await adminClient
      .from('gas_vouchers')
      .select('id')
      .eq('auth_provider', authProvider)
      .eq('auth_provider_id', authProviderId)
      .maybeSingle();

    if (duplicateCheck) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A voucher has already been issued to this social account.'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 새 Voucher 코드 생성
    const { data: voucherCode, error: codeGenError } = await adminClient
      .rpc('generate_voucher_code');

    if (codeGenError || !voucherCode) {
      throw new Error(`Failed to generate voucher code: ${codeGenError?.message}`);
    }

    // Voucher 생성
    const { data: newVoucher, error: createError } = await adminClient
      .from('gas_vouchers')
      .insert({
        user_id: user.id,
        voucher_code: voucherCode,
        auth_provider: authProvider,
        auth_provider_id: authProviderId,
        daily_limit_usd: 100.00
      })
      .select()
      .single();

    if (createError) {
      // Unique constraint violation
      if (createError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Voucher already exists for this account'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to create voucher: ${createError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          voucher_code: newVoucher.voucher_code,
          daily_limit_usd: newVoucher.daily_limit_usd,
          is_active: newVoucher.is_active,
          created_at: newVoucher.created_at,
          expires_at: newVoucher.expires_at,
          already_exists: false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
