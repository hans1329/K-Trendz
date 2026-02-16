import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, eventType } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 모든 위키 엔트리 가져오기
    const { data: wikiEntries, error: wikiError } = await supabase
      .from('wiki_entries')
      .select('id, title, schema_type, content')
      .order('view_count', { ascending: false })
      .limit(100);

    if (wikiError) throw wikiError;

    if (!wikiEntries || wikiEntries.length === 0) {
      return new Response(JSON.stringify({ suggestedWikiId: null, confidence: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // OpenAI로 가장 관련성 높은 위키 항목 찾기
    const prompt = `Given a calendar event with:
Title: "${title}"
Description: "${description || 'No description'}"
Event Type: "${eventType}"

Find the most relevant wiki entry from this list:
${wikiEntries.map((entry, idx) => `${idx + 1}. "${entry.title}" (Type: ${entry.schema_type})`).join('\n')}

Return ONLY the number (1-${wikiEntries.length}) of the most relevant entry, or 0 if none are relevant.
Consider:
- Artist names, member names, group names
- Album titles, song titles
- Event types matching the calendar event type

Response format: Just the number, nothing else.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that matches calendar events to wiki entries. Return only numbers.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content.trim();
    const selectedIndex = parseInt(resultText, 10);

    console.log('OpenAI suggested index:', selectedIndex, 'from text:', resultText);

    if (selectedIndex > 0 && selectedIndex <= wikiEntries.length) {
      const suggestedEntry = wikiEntries[selectedIndex - 1];
      return new Response(JSON.stringify({ 
        suggestedWikiId: suggestedEntry.id,
        suggestedTitle: suggestedEntry.title,
        confidence: 0.8 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ suggestedWikiId: null, confidence: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-wiki-entry function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});