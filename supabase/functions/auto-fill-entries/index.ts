import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background task to create placeholder entries (names only) - in batches
async function createPlaceholderEntries(
  entries: string[],
  type: string,
  userId: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabaseClient = createClient(supabaseUrl, supabaseKey);
  const BATCH_SIZE = 50; // Insert 50 at a time for efficiency
  
  let created = 0;
  let skipped = 0;

  console.log(`[BACKGROUND] Starting creation of ${entries.length} ${type} placeholder entries in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    try {
      console.log(`[BACKGROUND] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} entries`);

      // Prepare batch data
      const batchData = batch.map(name => ({
        title: name,
        schema_type: type,
        content: 'Pending AI content generation...',
        creator_id: userId,
        metadata: { pending_ai_generation: true },
        is_verified: false
      }));

      // Insert batch into database
      const { data, error: insertError } = await supabaseClient
        .from('wiki_entries')
        .insert(batchData)
        .select();

      if (insertError) {
        console.error(`[BACKGROUND] Failed to insert batch:`, insertError);
        skipped += batch.length;
      } else {
        created += data?.length || 0;
        console.log(`[BACKGROUND] Successfully created ${data?.length || 0} entries (Total: ${created}/${entries.length})`);
      }

    } catch (error) {
      console.error(`[BACKGROUND] Error creating batch:`, error);
      skipped += batch.length;
    }
  }

  console.log(`[BACKGROUND] Task completed: ${created} created, ${skipped} skipped out of ${entries.length} total`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Step 1: Get large pool of name suggestions from OpenAI (2000 names)
    console.log(`Requesting 2000 ${type} name suggestions from OpenAI...`);
    
    const suggestionPrompts: Record<string, string> = {
      artist: `List 2000 popular and notable K-pop groups/artists. Include current active groups, legendary groups, rising stars, solo artists, and subunits. Return ONLY a valid JSON array of names, nothing else. Format: ["BTS", "BLACKPINK", "NewJeans", ...]`,
      member: `List 2000 popular and notable K-pop idols/members from various groups. Include their stage names from all generations of K-pop. Return ONLY a valid JSON array of names, nothing else. Format: ["Jungkook", "Lisa", "Karina", ...]`,
      actor: `List 2000 popular and notable Korean actors/actresses. Include current stars, legendary actors, rising talents, and veteran actors. Return ONLY a valid JSON array of names in English, nothing else. Format: ["Song Kang", "Kim Soo-hyun", "Jun Ji-hyun", ...]`
    };

    const suggestionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a K-pop and Korean entertainment expert. Return only valid JSON arrays with as many unique items as possible, aiming for the exact number requested.' },
          { role: 'user', content: suggestionPrompts[type] || suggestionPrompts.artist }
        ],
        temperature: 0.8,
        max_tokens: 16000,
      }),
    });

    if (!suggestionResponse.ok) {
      const errorText = await suggestionResponse.text();
      console.error(`OpenAI API error: ${suggestionResponse.status}`, errorText);
      throw new Error(`OpenAI API error: ${suggestionResponse.status} - ${errorText}`);
    }

    const suggestionData = await suggestionResponse.json();
    const content = suggestionData.choices[0].message.content;
    
    console.log('OpenAI response preview:', content.substring(0, 200));
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to find JSON array in response:', content);
      throw new Error('Failed to parse suggestions from OpenAI - no JSON array found');
    }
    
    const suggestions: string[] = JSON.parse(jsonMatch[0]);
    console.log(`Got ${suggestions.length} name suggestions from OpenAI`);

    // Step 2: Check existing entries and filter out duplicates
    const { data: existingEntries } = await supabaseClient
      .from('wiki_entries')
      .select('title')
      .eq('schema_type', type)
      .limit(10000);

    const existingTitles = new Set((existingEntries || []).map(e => e.title.toLowerCase()));
    console.log(`Found ${existingTitles.size} existing ${type} entries`);

    // Step 3: Filter out duplicates
    const newEntries = suggestions
      .filter(name => !existingTitles.has(name.toLowerCase()));

    console.log(`${newEntries.length} entries will be created (${suggestions.length - newEntries.length} were duplicates)`);

    // Start background task and keep function alive until complete
    if (newEntries.length > 0) {
      const backgroundTask = createPlaceholderEntries(
        newEntries,
        type,
        user.id,
        supabaseUrl,
        supabaseServiceKey
      );
      
      // Use waitUntil to keep function alive until task completes
      // @ts-ignore - EdgeRuntime is available in Deno edge runtime
      if (typeof globalThis.EdgeRuntime !== 'undefined') {
        // @ts-ignore
        globalThis.EdgeRuntime.waitUntil(backgroundTask);
      } else {
        // Fallback: don't await but log
        backgroundTask.catch(err => console.error('Background task error:', err));
      }
    }

    // Return immediately with status
    return new Response(
      JSON.stringify({ 
        success: true, 
        total_suggestions: suggestions.length,
        already_exists: suggestions.length - newEntries.length,
        to_be_created: newEntries.length,
        message: `Creating ${newEntries.length} placeholder entries. Use "Fill Wiki Content with AI" to generate content.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-fill-entries function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
