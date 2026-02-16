import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const entryId = url.searchParams.get('id');

    console.log('Generate OG Image Request:', { entryId });

    if (!entryId) {
      return new Response('Entry ID required', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Supabase 클라이언트 (서비스 역할로 Storage 접근 가능)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Wiki entry 조회
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId);
    
    let query;
    if (isUUID) {
      query = supabase
        .from('wiki_entries')
        .select('*')
        .eq('id', entryId)
        .single();
    } else {
      query = supabase
        .from('wiki_entries')
        .select('*')
        .eq('slug', entryId)
        .single();
    }

    const { data: entry, error: entryError } = await query;

    if (entryError || !entry) {
      console.error('Wiki entry fetch error:', entryError);
      return new Response('Wiki entry not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // 엔트리의 기존 image_url을 OG 이미지로 사용
    const ogImageUrl = entry.image_url;

    if (!ogImageUrl) {
      console.log('No image_url found for entry');
      return new Response('Entry has no image', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log('Using entry image as OG image:', ogImageUrl);

    // Wiki entry에 og_image_url 업데이트
    await supabase
      .from('wiki_entries')
      .update({ og_image_url: ogImageUrl })
      .eq('id', entry.id);

    return new Response(JSON.stringify({ 
      success: true,
      ogImageUrl,
      entryId: entry.id,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});