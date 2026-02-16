import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { groupNames } = await req.json();
    
    if (!groupNames || !Array.isArray(groupNames) || groupNames.length === 0) {
      throw new Error('Please provide an array of group names');
    }

    if (groupNames.length > 100) {
      throw new Error('Maximum 100 groups at a time');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const naverClientId = Deno.env.get('NAVER_CLIENT_ID');
    const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!naverClientId || !naverClientSecret) {
      throw new Error('NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      total: groupNames.length,
      created: 0,
      skipped: 0,
      groups: [] as any[],
      skipped_groups: [] as string[],
      errors: [] as string[]
    };

    // Timeout helper function
    const fetchWithTimeout = async (url: string, options: any, timeoutMs = 60000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    };

    for (const groupName of groupNames) {
      try {
        console.log(`Processing group: ${groupName}`);

        // 이미 존재하는 그룹인지 확인
        const { data: existingGroup } = await supabase
          .from('wiki_entries')
          .select('id, title')
          .eq('schema_type', 'artist')
          .ilike('title', groupName.trim())
          .maybeSingle();

        if (existingGroup) {
          console.log(`Group "${groupName}" already exists, skipping...`);
          results.skipped++;
          results.skipped_groups.push(groupName);
          continue;
        }

        // OpenAI로 그룹 정보와 멤버 정보 생성
        const prompt = `Generate detailed information about the K-pop group "${groupName}" in JSON format.

Return ONLY a valid JSON object with this structure:
{
  "group": {
    "name": "group name",
    "description": "detailed markdown description of the group",
    "debut_year": "YYYY"
  },
  "members": [
    {
      "name": "full real name",
      "stage_name": "stage name",
      "position": "position in group (e.g., Main Vocalist, Lead Dancer, Rapper)",
      "birth_date": "YYYY-MM-DD",
      "description": "detailed markdown description"
    }
  ]
}

Important:
- Include ALL current and former members of the group
- Use REAL, ACCURATE birth dates in YYYY-MM-DD format
- Descriptions should be concise markdown (2-3 paragraphs max)
- Keep it factual and professional
- Position should be their official role in the group
- If exact birth date unknown, use YYYY-01-01`;

        console.log(`Requesting data from OpenAI for: ${groupName}`);

        // Retry logic with timeout
        let response;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            response = await fetchWithTimeout(
              'https://api.openai.com/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: 'You are a K-pop expert. Return ONLY valid JSON, no markdown formatting, no code blocks, just pure JSON. Include ALL members of the group.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 4000,
                }),
              },
              45000 // 45 seconds timeout
            );
            break; // Success, exit retry loop
          } catch (error) {
            retryCount++;
            console.error(`Attempt ${retryCount} failed for ${groupName}:`, error);
            
            if (retryCount > maxRetries) {
              results.errors.push(`${groupName}: Failed after ${maxRetries} retries (timeout or network error)`);
              response = null;
              break;
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          }
        }
        
        if (!response) {
          continue; // Skip to next group
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI API error:', response.status, errorText);
          results.errors.push(`${groupName}: OpenAI API error ${response.status}`);
          continue;
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();
        
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let groupData;
        try {
          groupData = JSON.parse(content);
        } catch (parseError) {
          console.error('JSON parse error for', groupName, ':', parseError);
          console.error('Content was:', content);
          results.errors.push(`${groupName}: Invalid JSON response from AI`);
          continue;
        }

        // Search for group image
        console.log(`Searching image for group: ${groupData.group.name}`);
        const groupImageUrl = await searchNaverImage(
          `${groupData.group.name} kpop group`,
          naverClientId,
          naverClientSecret
        );
        console.log(`Found group image: ${groupImageUrl}`);

        // 1. 그룹 wiki entry 생성
        const { data: groupEntry, error: groupError } = await supabase
          .from('wiki_entries')
          .insert([{
            title: groupData.group.name,
            content: groupData.group.description,
            schema_type: 'artist',
            creator_id: '00000000-0000-0000-0000-000000000000', // System user
            image_url: groupImageUrl,
            metadata: {
              debut_year: groupData.group.debut_year,
              type: 'group'
            }
          }])
          .select()
          .single();

        if (groupError) {
          console.error('Error creating group:', groupError);
          results.errors.push(`${groupName}: Failed to create group`);
          continue;
        }

        console.log(`Created group: ${groupData.group.name}`);

        // 2. 멤버들 wiki entry 생성
        const members = [];
        for (const member of groupData.members) {
          const memberName = member.stage_name || member.name;
          
          // 중복 멤버 체크: 같은 그룹의 같은 이름 멤버가 이미 있는지 확인
          const { data: existingMember } = await supabase
            .from('wiki_entries')
            .select('id, title')
            .eq('schema_type', 'member')
            .eq('metadata->>group_id', groupEntry.id)
            .ilike('title', memberName.trim())
            .maybeSingle();

          if (existingMember) {
            console.log(`Member "${memberName}" already exists for this group, skipping...`);
            members.push(existingMember);
            continue;
          }

          // Search for member image
          console.log(`Searching image for member: ${memberName}`);
          const memberImageUrl = await searchNaverImage(
            `${memberName} ${groupData.group.name} kpop`,
            naverClientId,
            naverClientSecret
          );
          console.log(`Found member image: ${memberImageUrl}`);

          const { data: memberEntry, error: memberError } = await supabase
            .from('wiki_entries')
            .insert([{
              title: memberName,
              content: member.description,
              schema_type: 'member',
              creator_id: '00000000-0000-0000-0000-000000000000',
              image_url: memberImageUrl,
              metadata: {
                real_name: member.name,
                stage_name: member.stage_name,
                position: member.position,
                birth_date: member.birth_date,
                group_id: groupEntry.id,
                group_name: groupData.group.name
              }
            }])
            .select()
            .single();

          if (!memberError) {
            members.push(memberEntry);
            console.log(`Created member: ${member.stage_name || member.name}`);
          } else {
            console.error('Error creating member:', memberError);
          }
        }

        results.created++;
        results.groups.push({
          name: groupData.group.name,
          id: groupEntry.id,
          members_count: members.length
        });

      } catch (error) {
        console.error(`Error processing ${groupName}:`, error);
        results.errors.push(`${groupName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Bulk creation results:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bulk-create-artists function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});