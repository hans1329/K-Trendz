import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Naver Image Search helper function
async function searchNaverImage(query: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodedQuery}&display=1&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error(`Naver Image Search failed for "${query}":`, response.status);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].link;
    }
    return null;
  } catch (error) {
    console.error(`Error searching image for "${query}":`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actorNames } = await req.json();
    
    if (!actorNames || !Array.isArray(actorNames) || actorNames.length === 0) {
      throw new Error('actorNames must be a non-empty array');
    }

    if (actorNames.length > 100) {
      throw new Error('Maximum 100 actors allowed per request');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const naverClientId = Deno.env.get('NAVER_CLIENT_ID');
    const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET');
    
    if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    if (!naverClientId || !naverClientSecret) {
      throw new Error('NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      total: actorNames.length,
      created: [] as string[],
      skipped: [] as string[],
      errors: [] as { actor: string; error: string }[],
    };

    for (const actorName of actorNames) {
      try {
        const trimmedName = actorName.trim();
        if (!trimmedName) continue;

        console.log(`Processing actor: ${trimmedName}`);

        // Check if actor already exists
        const { data: existing } = await supabase
          .from('wiki_entries')
          .select('id')
          .eq('title', trimmedName)
          .eq('schema_type', 'actor')
          .single();

        if (existing) {
          console.log(`Actor already exists: ${trimmedName}`);
          results.skipped.push(trimmedName);
          continue;
        }

        // Generate actor data using OpenAI with timeout and retry
        let actorData = null;
        const maxRetries = 2;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const prompt = `You are a Korean entertainment expert. Generate detailed information about the Korean actor/actress: "${trimmedName}".

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanations.

Return this exact JSON structure:
{
  "name": "${trimmedName}",
  "realName": "Real name in Korean and English (e.g., 이병헌 / Lee Byung-hun)",
  "birthDate": "YYYY-MM-DD format (use actual birth date if known, or approximate)",
  "nationality": "South Korean",
  "occupation": "Actor/Actress",
  "debutYear": "Year they debuted as number",
  "agency": "Current agency name if known",
  "description": "2-3 paragraph biography covering their career, notable works, and achievements. Mention their most famous dramas, films, and awards.",
  "notableWorks": ["Drama/Movie 1", "Drama/Movie 2", "Drama/Movie 3"],
  "awards": ["Award 1", "Award 2"]
}

Make sure all information is accurate and well-researched. Focus on their most significant achievements and popular works.`;

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
                    content: 'You are a Korean entertainment expert. Return ONLY valid JSON, no markdown, no code blocks.' 
                  },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1500,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`OpenAI API error for ${trimmedName}:`, response.status, errorText);
              throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            let content = data.choices[0].message.content.trim();
            
            // Remove markdown code blocks if present
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            actorData = JSON.parse(content);
            console.log(`Successfully generated data for ${trimmedName}`);
            break;

          } catch (error) {
            console.error(`Attempt ${attempt + 1} failed for ${trimmedName}:`, error);
            if (attempt === maxRetries) {
              throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (!actorData) {
          throw new Error('Failed to generate actor data after retries');
        }

        // Search for actor image
        console.log(`Searching image for actor: ${trimmedName}`);
        const actorImageUrl = await searchNaverImage(
          `${trimmedName} actor`,
          naverClientId,
          naverClientSecret
        );
        console.log(`Found actor image: ${actorImageUrl}`);

        // Create wiki entry for actor
        const actorContent = `# ${actorData.name}

## Profile
- **Real Name**: ${actorData.realName || 'N/A'}
- **Birth Date**: ${actorData.birthDate || 'N/A'}
- **Nationality**: ${actorData.nationality || 'South Korean'}
- **Occupation**: ${actorData.occupation || 'Actor/Actress'}
- **Debut Year**: ${actorData.debutYear || 'N/A'}
- **Agency**: ${actorData.agency || 'N/A'}

## Biography
${actorData.description || 'Information coming soon.'}

## Notable Works
${actorData.notableWorks && actorData.notableWorks.length > 0 
  ? actorData.notableWorks.map((work: string) => `- ${work}`).join('\n')
  : 'Information coming soon.'}

## Awards
${actorData.awards && actorData.awards.length > 0
  ? actorData.awards.map((award: string) => `- ${award}`).join('\n')
  : 'Information coming soon.'}`;

        const { error: insertError } = await supabase
          .from('wiki_entries')
          .insert({
            title: trimmedName,
            content: actorContent,
            schema_type: 'actor',
            image_url: actorImageUrl,
            creator_id: '00000000-0000-0000-0000-000000000000',
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Failed to insert actor ${trimmedName}:`, insertError);
          throw insertError;
        }

        console.log(`Successfully created wiki entry for actor: ${trimmedName}`);
        results.created.push(trimmedName);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing actor ${actorName}:`, error);
        results.errors.push({
          actor: actorName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('Bulk actor creation completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bulk-create-actors function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
