import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content, schemaType } = await req.json();

    console.log('Analyzing wiki entry:', { title, schemaType });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get potential parent entries based on schema type
    let potentialParents: any[] = [];
    
    if (schemaType === 'member') {
      // Get artist entries
      const { data } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .eq('schema_type', 'artist')
        .order('title', { ascending: true })
        .limit(500);
      potentialParents = data || [];
    } else if (schemaType === 'food' || schemaType === 'product') {
      // Get category entries
      const { data } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .eq('schema_type', 'category')
        .order('title', { ascending: true })
        .limit(500);
      potentialParents = data || [];
    } else if (schemaType === 'album') {
      // Get artist entries
      const { data } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .eq('schema_type', 'artist')
        .order('title', { ascending: true })
        .limit(500);
      potentialParents = data || [];
    } else if (schemaType === 'song') {
      // Get album entries
      const { data } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .eq('schema_type', 'album')
        .order('title', { ascending: true })
        .limit(500);
      potentialParents = data || [];
    } else {
      // Get all entries for general categories
      const { data } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .order('title', { ascending: true })
        .limit(500);
      potentialParents = data || [];
    }

    const systemPrompt = `You are a K-pop wiki relationship analyzer. Analyze the wiki entry content and suggest relevant relationships.

Available relationship types:
- member_of: Member belongs to a group/artist
- product_of: Product belongs to a manufacturer/company
- belongs_to_category: Entry belongs to a category
- sub_category_of: Sub-category belongs to parent category
- album_of: Album belongs to an artist
- song_of: Song belongs to an album
- actor_in: Actor appears in a drama/movie

Available parent entries:
${potentialParents.map(p => `- ${p.title} (${p.id})`).join('\n')}

Return only high-confidence relationships based on explicit mentions in the content.`;

    const userPrompt = `Title: ${title}
Schema Type: ${schemaType}
Content: ${content}

Analyze this wiki entry and suggest relationships. Be conservative - only suggest relationships that are explicitly mentioned or very clearly implied in the content.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
            type: 'function',
            function: {
              name: 'suggest_relationships',
              description: 'Suggest wiki entry relationships based on content analysis',
              parameters: {
                type: 'object',
                properties: {
                  relationships: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        parent_entry_id: { 
                          type: 'string',
                          description: 'UUID of the parent entry'
                        },
                        parent_entry_title: {
                          type: 'string',
                          description: 'Title of the parent entry for display'
                        },
                        relationship_type: { 
                          type: 'string',
                          enum: ['member_of', 'product_of', 'belongs_to_category', 'sub_category_of', 'album_of', 'song_of', 'actor_in']
                        },
                        confidence: {
                          type: 'number',
                          description: 'Confidence score 0-1'
                        },
                        reason: {
                          type: 'string',
                          description: 'Brief explanation for this suggestion'
                        }
                      },
                      required: ['parent_entry_id', 'parent_entry_title', 'relationship_type', 'confidence', 'reason'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['relationships'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_relationships' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ relationships: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    
    // Filter only high confidence suggestions (>0.7) and validate parent entries exist
    const validParentIds = new Set(potentialParents.map(p => p.id));
    const highConfidenceSuggestions = suggestions.relationships.filter(
      (r: any) => r.confidence > 0.7 && validParentIds.has(r.parent_entry_id)
    );

    console.log(`Suggested ${highConfidenceSuggestions.length} valid relationships`);

    return new Response(
      JSON.stringify({ relationships: highConfidenceSuggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error suggesting relationships:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
