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
    const { missingOnly = false, entryIds = [] } = await req.json().catch(() => ({ missingOnly: false, entryIds: [] }));
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Get entries - either specific IDs or all based on filters
    let query = supabaseClient
      .from('wiki_entries')
      .select('id, title, schema_type, metadata')
      .in('schema_type', ['artist', 'member']);

    // If specific entry IDs provided, use them
    if (entryIds.length > 0) {
      query = query.in('id', entryIds);
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    // Filter entries if missingOnly is true and no specific IDs provided
    const entriesToProcess = (missingOnly && entryIds.length === 0)
      ? (entries || []).filter(entry => !entry.metadata?.music_charts)
      : (entries || []);

    console.log(`Processing ${entriesToProcess.length} entries (total: ${entries?.length || 0}, missingOnly: ${missingOnly}, specific IDs: ${entryIds.length})`);

    let updatedCount = 0;

    // Process each entry
    for (const entry of entriesToProcess) {
      try {
        // Use OpenAI to get music chart information
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are a K-pop expert with knowledge of music charts. Provide accurate chart data for K-pop artists. Return only valid JSON.' 
              },
              { 
                role: 'user', 
                content: `Provide music chart information for "${entry.title}". Return JSON with this format:
{
  "spotify": {
    "monthly_listeners": 5000000,
    "top_songs": [
      {"title": "Song Name", "streams": 100000000, "peak_chart_position": 1}
    ]
  },
  "melon": {
    "top_songs": [
      {"title": "Song Name", "peak_position": 1, "weeks_on_chart": 20}
    ]
  },
  "discography": [
    {"title": "Album Name", "release_date": "2024-01-01", "type": "Full Album"}
  ]
}
Include only accurate information you're confident about.` 
              }
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          console.error(`OpenAI API error for ${entry.title}:`, response.status);
          continue;
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        
        const musicData = JSON.parse(jsonMatch[0]);

        // Update metadata with music chart data
        const updatedMetadata = {
          ...(entry.metadata || {}),
          music_charts: musicData
        };

        const { error: updateError } = await supabaseClient
          .from('wiki_entries')
          .update({ metadata: updatedMetadata })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Failed to update ${entry.title}:`, updateError);
          continue;
        }

        updatedCount++;
        console.log(`Updated music charts for: ${entry.title}`);

      } catch (error) {
        console.error(`Error processing ${entry.title}:`, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        total: entriesToProcess.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-music-charts function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
