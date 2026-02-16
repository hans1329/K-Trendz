import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { count = 100 } = await req.json();
    
    if (count < 1 || count > 200) {
      throw new Error('Count must be between 1 and 200');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const prompt = `Generate a list of ${count} popular and influential K-pop groups from various eras (2nd gen, 3rd gen, 4th gen, 5th gen).

Include:
- Active and legendary groups
- Both boy groups and girl groups
- Mix of major agency groups and smaller companies
- Include recent debuts and established groups

Return ONLY a JSON array of group names, nothing else:
["BTS", "BLACKPINK", ...]

No explanations, no markdown, just pure JSON array.`;

    console.log(`Requesting ${count} K-pop groups from AI`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a K-pop expert. Return ONLY valid JSON arrays, no markdown, no code blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const groups = JSON.parse(content);

    if (!Array.isArray(groups)) {
      throw new Error('Invalid response format');
    }

    console.log(`Successfully generated ${groups.length} K-pop groups`);

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-kpop-groups function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});