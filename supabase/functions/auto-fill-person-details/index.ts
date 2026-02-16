import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PersonDetails {
  real_name?: string;
  birth_date?: string;
  gender?: string;
  nationality?: string;
  blood_type?: string;
  height?: number;
  weight?: number;
}

// OpenAI로 직접 인물 정보 추출
async function extractPersonDetailsWithAI(
  title: string,
  schemaType: string,
  openAIApiKey: string
): Promise<PersonDetails | null> {
  try {
    const systemPrompt = `You are an expert on K-pop idols, Korean actors, and Korean artists. Extract accurate biographical information.

CRITICAL: Only return information you are CERTAIN about. If you don't know something, return null for that field.

Fields to extract:
- real_name: Full name in English/Romanized form (e.g., "Park Ji-min" or "Jimin")
- birth_date: YYYY-MM-DD format ONLY
- gender: "male" or "female" only
- nationality: Country name in English (e.g., "South Korea")
- blood_type: A, B, AB, or O only
- height: Number in centimeters (e.g., 175)
- weight: Number in kilograms (e.g., 60)`;

    const userPrompt = `Extract biographical information for: ${title}
Type: ${schemaType}

Provide accurate information about this person.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_person_details",
              description: "Extract structured person information",
              parameters: {
                type: "object",
                properties: {
                  real_name: { type: ["string", "null"], description: "Full name in English, null if not known" },
                  birth_date: { type: ["string", "null"], description: "Birth date in YYYY-MM-DD format, null if not known" },
                  gender: { type: ["string", "null"], enum: ["male", "female", null], description: "Gender, null if not known" },
                  nationality: { type: ["string", "null"], description: "Country name in English, null if not known" },
                  blood_type: { type: ["string", "null"], enum: ["A", "B", "AB", "O", null], description: "Blood type, null if not known" },
                  height: { type: ["number", "null"], description: "Height in centimeters, null if not known" },
                  weight: { type: ["number", "null"], description: "Weight in kilograms, null if not known" }
                },
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_person_details" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in response');
      return null;
    }

    const details = JSON.parse(toolCall.function.arguments);
    
    // null 값 필터링
    const cleanedDetails: PersonDetails = {};
    if (details.real_name && details.real_name !== 'null') cleanedDetails.real_name = details.real_name;
    if (details.birth_date && details.birth_date !== 'null') cleanedDetails.birth_date = details.birth_date;
    if (details.gender && details.gender !== 'null') cleanedDetails.gender = details.gender;
    if (details.nationality && details.nationality !== 'null') cleanedDetails.nationality = details.nationality;
    if (details.blood_type && details.blood_type !== 'null') cleanedDetails.blood_type = details.blood_type;
    if (details.height && typeof details.height === 'number') cleanedDetails.height = details.height;
    if (details.weight && typeof details.weight === 'number') cleanedDetails.weight = details.weight;
    
    return cleanedDetails;
  } catch (error) {
    console.error('Extract person details error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT에서 사용자 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // 사용자 JWT로 클라이언트 생성하여 권한 확인
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin/Moderator 권한 확인 (user_roles 테이블 사용)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role key로 데이터 작업용 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      processed: 0,
      updated: 0,
      failed: 0,
      details: [] as any[]
    };

    const BATCH_SIZE = 3; // OpenAI API 호출 최소화
    let batchNumber = 1;
    
    console.log(`\n=== Processing Batch #${batchNumber} ===`);
    console.log(`Batch #${batchNumber}: Processing ${BATCH_SIZE} entries`);

    // 단일 배치만 가져오기
    const { data: entries, error: fetchError } = await supabase
      .from('wiki_entries')
      .select('id, title, schema_type, real_name, birth_date, gender, nationality, blood_type, height, weight')
      .in('schema_type', ['member', 'actor', 'artist'])
      .or('real_name.is.null,birth_date.is.null,gender.is.null,nationality.is.null,blood_type.is.null,height.is.null,weight.is.null')
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    if (!entries || entries.length === 0) {
      console.log('No more entries to process');
      return new Response(
        JSON.stringify({
          processed: 0,
          updated: 0,
          failed: 0,
          hasMore: false,
          details: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${entries.length} entries`);

    for (const entry of entries) {
      console.log(`Processing: ${entry.title} (${entry.schema_type})`);
      results.processed++;

      try {
        console.log(`Extracting info for ${entry.title} using OpenAI`);
        
        // OpenAI로 직접 정보 추출 (Rate Limit 방지 위해 딜레이)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const personDetails = await extractPersonDetailsWithAI(
          entry.title,
          entry.schema_type,
          openAIApiKey
        );
        
        console.log(`✅ Extracted for ${entry.title}:`, JSON.stringify(personDetails, null, 2));

        if (!personDetails || Object.keys(personDetails).length === 0) {
          console.log(`Could not extract details for ${entry.title}`);
          results.failed++;
          results.details.push({ title: entry.title, status: 'extraction_failed' });
          continue;
        }

        const updateData: any = {};
        
        // 무효한 값 체크 함수
        const isInvalidValue = (value: any): boolean => {
          if (value === null || value === undefined) return true;
          if (typeof value === 'string') {
            const lower = value.trim().toLowerCase();
            return lower === '' || lower === 'unknown' || lower === 'not found' || lower === 'n/a' || lower === 'null';
          }
          if (typeof value === 'number') return value <= 0;
          return false;
        };
        
        // 기존 값이 없거나 무효한 값이면 새로운 값으로 업데이트
        if ((isInvalidValue(entry.real_name)) && personDetails.real_name) updateData.real_name = personDetails.real_name;
        if ((isInvalidValue(entry.birth_date)) && personDetails.birth_date) updateData.birth_date = personDetails.birth_date;
        if ((isInvalidValue(entry.gender)) && personDetails.gender) updateData.gender = personDetails.gender;
        if ((isInvalidValue(entry.nationality)) && personDetails.nationality) updateData.nationality = personDetails.nationality;
        if ((isInvalidValue(entry.blood_type)) && personDetails.blood_type) updateData.blood_type = personDetails.blood_type;
        if ((isInvalidValue(entry.height)) && personDetails.height) updateData.height = personDetails.height;
        if ((isInvalidValue(entry.weight)) && personDetails.weight) updateData.weight = personDetails.weight;

        // 상세 로깅
        console.log(`📊 Update decision for ${entry.title}:`, {
          extracted: personDetails,
          current: {
            real_name: entry.real_name,
            birth_date: entry.birth_date,
            gender: entry.gender,
            nationality: entry.nationality,
            blood_type: entry.blood_type,
            height: entry.height,
            weight: entry.weight,
          },
          willUpdate: updateData
        });

        if (Object.keys(updateData).length === 0) {
          console.log(`No new fields to update for ${entry.title}`);
          results.details.push({ 
            title: entry.title, 
            status: 'no_update_needed',
            extracted: personDetails
          });
          continue;
        }

        console.log(`Updating ${entry.title} with:`, updateData);

        const { error: updateError } = await supabase
          .from('wiki_entries')
          .update(updateData)
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Update error for ${entry.title}:`, updateError);
          results.failed++;
          results.details.push({ title: entry.title, status: 'update_failed', error: updateError.message });
        } else {
          console.log(`Successfully updated ${entry.title}`);
          results.updated++;
          results.details.push({ 
            title: entry.title, 
            status: 'success',
            details: personDetails
          });
        }

        // OpenAI Rate Limit 방지
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing ${entry.title}:`, error);
        results.failed++;
        results.details.push({ 
          title: entry.title, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`\nBatch #${batchNumber} complete: Processed ${results.processed}, Updated ${results.updated}, Failed ${results.failed}`);

    return new Response(
      JSON.stringify({
        processed: results.processed,
        updated: results.updated,
        failed: results.failed,
        hasMore: entries.length === BATCH_SIZE,
        details: results.details
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
