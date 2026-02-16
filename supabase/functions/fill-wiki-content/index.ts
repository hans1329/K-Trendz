import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract social links from Namuwiki raw text
function extractSocialLinks(rawText: string): any {
  const socialLinks: any = {};
  
  // Instagram
  const igPatterns = [
    /instagram\.com\/([a-zA-Z0-9._]+)/gi,
    /www\.instagram\.com\/([a-zA-Z0-9._]+)/gi,
  ];
  
  for (const pattern of igPatterns) {
    const matches = rawText.matchAll(pattern);
    for (const match of matches) {
      const username = match[1];
      if (username && username.length > 0 && username !== 'p' && username !== 'reel' && username !== 'stories') {
        socialLinks.instagram = {
          url: `https://instagram.com/${username}`,
          verified: true
        };
        break;
      }
    }
    if (socialLinks.instagram) break;
  }
  
  // Twitter/X
  const twitterPatterns = [
    /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
    /www\.(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi
  ];
  
  for (const pattern of twitterPatterns) {
    const matches = rawText.matchAll(pattern);
    for (const match of matches) {
      const username = match[1];
      if (username && username !== 'share' && username !== 'intent' && username !== 'i') {
        socialLinks.twitter = {
          url: `https://twitter.com/${username}`,
          verified: true
        };
        break;
      }
    }
    if (socialLinks.twitter) break;
  }
  
  // YouTube
  const ytPatterns = [
    /youtube\.com\/([@c]|channel\/)([^\/\?\s"'<>]+)/gi,
    /www\.youtube\.com\/([@c]|channel\/)([^\/\?\s"'<>]+)/gi,
  ];
  
  for (const pattern of ytPatterns) {
    const matches = rawText.matchAll(pattern);
    for (const match of matches) {
      if (match[2]) {
        const channelId = `${match[1]}${match[2]}`;
        socialLinks.youtube = {
          url: `https://youtube.com/${channelId}`,
          verified: true
        };
        break;
      }
    }
    if (socialLinks.youtube) break;
  }
  
  // TikTok
  const ttPatterns = [
    /tiktok\.com\/@([a-zA-Z0-9._]+)/gi,
    /www\.tiktok\.com\/@([a-zA-Z0-9._]+)/gi
  ];
  
  for (const pattern of ttPatterns) {
    const matches = rawText.matchAll(pattern);
    for (const match of matches) {
      const username = match[1];
      if (username) {
        socialLinks.tiktok = {
          url: `https://tiktok.com/@${username}`,
          verified: true
        };
        break;
      }
    }
    if (socialLinks.tiktok) break;
  }
  
  return Object.keys(socialLinks).length > 0 ? socialLinks : null;
}

// Helper function to fetch from Namuwiki
async function fetchFromNamuwiki(title: string) {
  try {
    const apiUrl = `https://namu.wiki/api/raw/${encodeURIComponent(title)}`;
    
    console.log(`[NAMUWIKI] Fetching from ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'KTRENDZ-WikiBot/1.0 (https://k-trendz.com; contact@k-trendz.com)',
      }
    });

    if (!response.ok) {
      console.log(`[NAMUWIKI] Not found: ${title}`);
      return null;
    }

    const rawText = await response.text();
    
    if (!rawText || rawText.length < 100) {
      console.log(`[NAMUWIKI] Content too short for: ${title}`);
      return null;
    }

    console.log(`[NAMUWIKI] Got content for ${title}, length: ${rawText.length}`);
    
    // Extract social links
    const socialLinks = extractSocialLinks(rawText);
    
    if (socialLinks) {
      console.log(`[NAMUWIKI] Found social links for ${title}:`, Object.keys(socialLinks));
    }
    
    // For now, we'll use the raw text length as a quality indicator
    // You could add more sophisticated parsing here
    return {
      rawText,
      socialLinks,
      source: 'namu.wiki'
    };
  } catch (error) {
    console.error(`[NAMUWIKI] Error fetching ${title}:`, error);
    return null;
  }
}

// Helper function to fetch from Wikipedia
async function fetchFromWikipedia(title: string, lang: string = 'en') {
  try {
    const encodedTitle = encodeURIComponent(title);
    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
    
    console.log(`[WIKIPEDIA] Fetching from ${summaryUrl}`);
    
    const response = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'KTRENDZ-WikiBot/1.0 (https://k-trendz.com; contact@k-trendz.com)',
      }
    });

    if (!response.ok) {
      console.log(`[WIKIPEDIA] ${lang} Wikipedia not found for: ${title}`);
      return null;
    }

    const data = await response.json();
    
    // Check if it's a disambiguation page
    if (data.type === 'disambiguation') {
      console.log(`[WIKIPEDIA] Disambiguation page found for: ${title}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[WIKIPEDIA] Error fetching ${title} from ${lang}:`, error);
    return null;
  }
}

// Helper function to parse infobox data from Wikipedia HTML
async function fetchWikipediaInfobox(title: string, lang: string = 'en') {
  try {
    const encodedTitle = encodeURIComponent(title);
    const htmlUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodedTitle}`;
    
    const response = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'KTRENDZ-WikiBot/1.0 (https://k-trendz.com; contact@k-trendz.com)',
      }
    });

    if (!response.ok) return {};

    const html = await response.text();
    const metadata: any = {};

    // Extract birthday (다양한 패턴)
    const birthPatterns = [
      /(?:Born|출생|생년월일)[^\d]*(\d{4})[년-](\d{1,2})[월-](\d{1,2})/i,
      /(\d{4})[년-](\d{1,2})[월-](\d{1,2})/,
    ];

    for (const pattern of birthPatterns) {
      const match = html.match(pattern);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        metadata.birthday = `${year}-${month}-${day}`;
        console.log(`[WIKIPEDIA] Extracted birthday: ${metadata.birthday}`);
        break;
      }
    }

    // Extract members list (for groups)
    const membersMatch = html.match(/(?:Members|멤버)[^<]*<ul>(.*?)<\/ul>/s);
    if (membersMatch) {
      const membersList = membersMatch[1];
      const memberNames = [...membersList.matchAll(/<li[^>]*>([^<]+)</g)].map(m => m[1].trim());
      if (memberNames.length > 0) {
        metadata.memberNames = memberNames;
        console.log(`[WIKIPEDIA] Extracted ${memberNames.length} members`);
      }
    }

    return metadata;
  } catch (error) {
    console.error(`[WIKIPEDIA] Error parsing infobox for ${title}:`, error);
    return {};
  }
}

// Helper function to convert Wikipedia summary to markdown
function convertToMarkdown(wikiData: any, infoboxData: any): string {
  let markdown = `# ${wikiData.title}\n\n`;
  
  // 이미지는 스토리지에 업로드된 것을 사용하므로 Wikipedia 이미지는 포함하지 않음
  
  // Add extract (summary)
  if (wikiData.extract) {
    markdown += `${wikiData.extract}\n\n`;
  }
  
  // Add description if different from extract
  if (wikiData.description && !wikiData.extract?.includes(wikiData.description)) {
    markdown += `**${wikiData.description}**\n\n`;
  }
  
  // Add source link
  if (wikiData.content_urls?.desktop?.page) {
    markdown += `\n---\n\n*Source: [Wikipedia](${wikiData.content_urls.desktop.page})*\n`;
  }
  
  return markdown;
}

// AI-powered content generation using training data
async function generateWithAI(
  title: string, 
  schemaType: string, 
  openAIApiKey: string
) {
  console.log(`[AI] Generating content for ${title} (${schemaType}) using AI training data`);
  
  const systemPrompt = `You are a K-pop/entertainment expert with comprehensive knowledge of Korean entertainment industry. Use your training data to provide accurate, detailed information.

CRITICAL ACCURACY RULES:
1. For group MEMBERS: List ALL members with both stage names and real names (if known)
   - Do NOT skip any members
   - Verify the count is complete
   - Include former members separately if applicable
2. For BIRTH DATES: Provide in YYYY-MM-DD format with 100% accuracy
   - Only include if you are certain of the date
   - Do not guess or approximate
3. For DEBUT DATES: Provide in YYYY-MM-DD format (for groups/artists)
4. Write comprehensive content in English markdown format with proper headings
5. IMPORTANT: Do NOT include social media links - they will be added separately`;

  const userPrompt = `Create a comprehensive wiki entry for "${title}" (${schemaType}).

${schemaType === 'artist' ? `
REQUIRED INFORMATION:
1. **MEMBERS** (MOST CRITICAL):
   - List ALL current members with stage names and real names
   - Include birth dates for each member if known
   - IMPORTANT: Include exact positions/roles for each member (Leader, Main Vocalist, Main Rapper, Main Dancer, Visual, Maknae, etc.)
   - List former members separately if applicable
   - Double-check: Did you include EVERY member?

2. **GROUP INFORMATION**:
   - Debut date (exact date if known)
   - Agency/Company
   - Genre and concept
   - Notable achievements

3. **CAREER HIGHLIGHTS**:
   - Major releases and albums
   - Awards and recognitions
   - Tours and concerts

` : schemaType === 'member' ? `
REQUIRED INFORMATION:
1. **PERSONAL DETAILS**:
   - Real name and stage name
   - Birth date (YYYY-MM-DD) - MUST be accurate
   - Group affiliation (EXACT GROUP NAME)
   - Position/role in group (be specific: Leader, Main Vocalist, etc.)

2. **CAREER**:
   - Debut information
   - Notable achievements
   - Solo activities if any

` : `
REQUIRED INFORMATION:
1. **PERSONAL DETAILS**:
   - Full name
   - Birth date (YYYY-MM-DD) - MUST be accurate
   - Nationality

2. **CAREER**:
   - Notable works (dramas, movies, variety shows)
   - Awards and recognitions
   - Career highlights
`}

Format as structured markdown with clear headings. Be comprehensive but accurate.`;

  const tools = [{
    type: "function",
    function: {
      name: "create_wiki_entry",
      description: "Create a structured wiki entry with extracted metadata",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Comprehensive wiki content in markdown format with # headings, ## subheadings, etc."
          },
          birthday: {
            type: "string",
            description: "Birth date in YYYY-MM-DD format (for members/actors only)"
          },
          real_name: {
            type: "string",
            description: "Real name (for members/actors)"
          },
          stage_name: {
            type: "string", 
            description: "Stage name (for members)"
          },
          members: {
            type: "array",
            description: "COMPLETE list of ALL members for artist/group - do not skip anyone",
            items: {
              type: "object",
              properties: {
                stage_name: { type: "string", description: "Member's stage name" },
                real_name: { type: "string", description: "Member's real name" },
                birthday: { type: "string", description: "Member's birth date in YYYY-MM-DD format" },
                position: { type: "string", description: "Position/role in group (Leader, Main Vocalist, Main Rapper, etc.)" }
              },
              required: ["stage_name"]
            }
          },
          group_name: {
            type: "string",
            description: "Name of the group this member belongs to (for members only)"
          },
          position: {
            type: "string",
            description: "Position/role in the group (for members only)"
          },
          debut_date: {
            type: "string",
            description: "Debut date in YYYY-MM-DD format (for artists)"
          }
        },
        required: ["content"]
      }
    }
  }];

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
      tools: tools,
      tool_choice: { type: "function", function: { name: "create_wiki_entry" } },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices[0].message.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error('No tool call returned from AI');
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log(`[AI] Generated structured data for ${title}:`, {
    contentLength: result.content?.length || 0,
    hasMembers: !!result.members,
    membersCount: result.members?.length || 0,
    membersList: result.members?.map((m: any) => `${m.stage_name}${m.real_name ? ` (${m.real_name})` : ''}`).join(', ') || 'none',
    hasBirthday: !!result.birthday,
    birthday: result.birthday || 'none',
    hasDebutDate: !!result.debut_date,
    debutDate: result.debut_date || 'none'
  });
  
  return result;
}

// Background task to generate content in batches
async function generateContentInBatches(
  openAIApiKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  type?: string
) {
  const supabaseClient = createClient(supabaseUrl, supabaseKey);
  const BATCH_SIZE = 10;
  
  console.log(`[BACKGROUND] Starting content generation for ${type || 'all types'}`);

  // Get all entries for content generation
  let query = supabaseClient
    .from('wiki_entries')
    .select('id, title, schema_type');

  if (type) {
    query = query.eq('schema_type', type);
  }

  const { data: pendingEntries, error: fetchError } = await query;

  if (fetchError) {
    console.error('[BACKGROUND] Failed to fetch pending entries:', fetchError);
    return;
  }

  if (!pendingEntries || pendingEntries.length === 0) {
    console.log('[BACKGROUND] No pending entries found');
    return;
  }

  console.log(`[BACKGROUND] Found ${pendingEntries.length} entries needing content generation`);

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  // Process in batches
  for (let i = 0; i < pendingEntries.length; i += BATCH_SIZE) {
    const batch = pendingEntries.slice(i, i + BATCH_SIZE);
    console.log(`[BACKGROUND] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} entries)`);

    for (const entry of batch) {
      try {
        console.log(`[BACKGROUND] Generating content for: ${entry.title} (${entry.schema_type})`);

        let metadata: any = {};

        // Use AI training data to generate content
        console.log(`[BACKGROUND] Generating content for ${entry.title} using AI training data`);
        
        const aiResult = await generateWithAI(
          entry.title,
          entry.schema_type,
          openAIApiKey
        );

        console.log(`[BACKGROUND] AI result for ${entry.title}:`, {
          hasContent: !!aiResult.content,
          contentLength: aiResult.content?.length || 0,
          hasMembers: !!aiResult.members,
          membersCount: aiResult.members?.length || 0,
          memberNames: aiResult.members?.map((m: any) => `${m.stage_name}${m.real_name ? ` (${m.real_name})` : ''}`) || [],
          hasBirthday: !!aiResult.birthday,
          birthday: aiResult.birthday || 'none',
          hasDebutDate: !!aiResult.debut_date,
          debutDate: aiResult.debut_date || 'none'
        });

        // Extract generated content
        const generatedContent = aiResult.content;
        
        // Build metadata from AI extraction
        metadata.source = 'ai-training-data';
        metadata.ai_model = 'gpt-4o-mini';
        metadata.generation_date = new Date().toISOString();
        
        if (aiResult.birthday) {
          metadata.birthday = aiResult.birthday;
          console.log(`[BACKGROUND] Extracted birthday: ${aiResult.birthday}`);
        }
        
        if (aiResult.real_name) {
          metadata.real_name = aiResult.real_name;
        }
        
        if (aiResult.stage_name) {
          metadata.stage_name = aiResult.stage_name;
        }
        
        if (aiResult.debut_date) {
          metadata.debut_date = aiResult.debut_date;
        }

        if (aiResult.group_name) {
          metadata.group_name = aiResult.group_name;
        }

        if (aiResult.position) {
          metadata.position = aiResult.position;
        }

        // For artists, try to link members and update their group_id
        if (entry.schema_type === 'artist' && aiResult.members && aiResult.members.length > 0) {
          console.log(`[BACKGROUND] AI found ${aiResult.members.length} members for ${entry.title}:`, 
            aiResult.members.map((m: any) => `${m.stage_name || m.real_name}`).join(', '));
          
          const memberIds: string[] = [];
          const unmatchedMembers: string[] = [];
          
          for (const member of aiResult.members) {
            const searchName = member.stage_name || member.real_name;
            if (!searchName) continue;
            
            // Try multiple search strategies
            let memberEntry = null;
            
            // Strategy 1: Exact title match
            const { data: exactMatch } = await supabaseClient
              .from('wiki_entries')
              .select('id, title, metadata')
              .eq('schema_type', 'member')
              .ilike('title', searchName)
              .limit(1)
              .single();
            
            if (exactMatch) {
              memberEntry = exactMatch;
              console.log(`[BACKGROUND] Exact match: ${searchName} -> ${exactMatch.title}`);
            }
            
            // Strategy 2: Partial title match
            if (!memberEntry) {
              const { data: partialMatch } = await supabaseClient
                .from('wiki_entries')
                .select('id, title, metadata')
                .eq('schema_type', 'member')
                .ilike('title', `%${searchName}%`)
                .limit(1)
                .single();
              
              if (partialMatch) {
                memberEntry = partialMatch;
                console.log(`[BACKGROUND] Partial match: ${searchName} -> ${partialMatch.title}`);
              }
            }
            
            // Strategy 3: Metadata search (stage_name or real_name)
            if (!memberEntry && member.real_name) {
              const { data: metadataMatch } = await supabaseClient
                .from('wiki_entries')
                .select('id, title, metadata')
                .eq('schema_type', 'member')
                .or(`metadata->>stage_name.ilike.%${member.stage_name || ''}%,metadata->>real_name.ilike.%${member.real_name}%`)
                .limit(1)
                .single();
              
              if (metadataMatch) {
                memberEntry = metadataMatch;
                console.log(`[BACKGROUND] Metadata match: ${searchName} -> ${metadataMatch.title}`);
              }
            }
            
            if (memberEntry) {
              memberIds.push(memberEntry.id);
              
              // Get current metadata and update with group info
              const currentMetadata = memberEntry.metadata || {};
              const updatedMetadata = {
                ...currentMetadata,
                group_id: entry.id,
                group_name: entry.title
              };
              
              // Add position if available from AI result
              if (member.position) {
                updatedMetadata.position = member.position;
              }
              
              // Add birthday if available from AI result
              if (member.birthday) {
                updatedMetadata.birthday = member.birthday;
              }
              
              // Update member entry with group_id and position
              const { error: memberUpdateError } = await supabaseClient
                .from('wiki_entries')
                .update({ metadata: updatedMetadata })
                .eq('id', memberEntry.id);
              
              if (memberUpdateError) {
                console.error(`[BACKGROUND] Failed to update member ${searchName}:`, memberUpdateError);
              } else {
                console.log(`[BACKGROUND] Updated ${searchName}:`, {
                  group_id: entry.id,
                  group_name: entry.title,
                  position: member.position || 'N/A',
                  birthday: member.birthday || 'N/A'
                });
              }
            } else {
              unmatchedMembers.push(searchName);
              console.log(`[BACKGROUND] No match found for member: ${searchName}`);
            }
          }
          
          if (memberIds.length > 0) {
            metadata.member_ids = memberIds;
            console.log(`[BACKGROUND] Linked ${memberIds.length}/${aiResult.members.length} members to ${entry.title}`);
          }
          
          if (unmatchedMembers.length > 0) {
            console.log(`[BACKGROUND] Unmatched members for ${entry.title}:`, unmatchedMembers.join(', '));
          }
        }

        // For members, try to find and link their group
        if (entry.schema_type === 'member' && aiResult.group_name) {
          console.log(`[BACKGROUND] Member ${entry.title} belongs to group: ${aiResult.group_name}`);
          
          // Try to find the group entry
          const { data: groupEntry } = await supabaseClient
            .from('wiki_entries')
            .select('id, title')
            .eq('schema_type', 'artist')
            .ilike('title', aiResult.group_name)
            .limit(1)
            .single();
          
          if (groupEntry) {
            metadata.group_id = groupEntry.id;
            metadata.group_name = groupEntry.title;
            console.log(`[BACKGROUND] Linked member ${entry.title} to group ${groupEntry.title} (${groupEntry.id})`);
          } else {
            console.log(`[BACKGROUND] Group not found for member ${entry.title}: ${aiResult.group_name}`);
          }
        }

        // Skip Wikipedia fallback - AI is primary source now
        let wikiData = null;
        let wikiSource = '';
        
        if (wikiData) {
          wikiSource = 'ko.wikipedia.org';
          console.log(`[BACKGROUND] Found on Korean Wikipedia: ${entry.title}`);
        } else {
          // Try English Wikipedia
          wikiData = await fetchFromWikipedia(entry.title, 'en');
          if (wikiData) {
            wikiSource = 'en.wikipedia.org';
            console.log(`[BACKGROUND] Found on English Wikipedia: ${entry.title}`);
          }
        }

        // Wikipedia is now optional - can be used as additional reference if needed
        if (wikiData) {
          console.log(`[BACKGROUND] Found Wikipedia entry for ${entry.title} as additional reference`);
          metadata.wikipedia_source = wikiSource;
        }

        // Update entry with generated content and metadata
        const { error: updateError } = await supabaseClient
          .from('wiki_entries')
          .update({
            content: generatedContent,
            metadata: metadata,
            is_verified: true
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`[BACKGROUND] Failed to update ${entry.title}:`, updateError);
          totalFailed++;
        } else {
          totalSuccess++;
          console.log(`[BACKGROUND] Successfully generated content for: ${entry.title} (${totalSuccess}/${pendingEntries.length})`);
        }

        totalProcessed++;

        // Rate limiting - 2 seconds between requests (increased due to multiple API calls)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[BACKGROUND] Error generating content for ${entry.title}:`, error);
        totalFailed++;
        totalProcessed++;
      }
    }

    // Longer pause between batches
    if (i + BATCH_SIZE < pendingEntries.length) {
      console.log(`[BACKGROUND] Batch complete. Pausing 5 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`[BACKGROUND] Content generation completed: ${totalSuccess} success, ${totalFailed} failed out of ${totalProcessed} total`);
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

    // Count all entries
    let countQuery = supabaseClient
      .from('wiki_entries')
      .select('id', { count: 'exact', head: true });

    if (type) {
      countQuery = countQuery.eq('schema_type', type);
    }

    const { count } = await countQuery;

    console.log(`Starting content generation for ${count || 0} pending entries`);

    // Start background task and keep function alive until complete
    if (count && count > 0) {
      const backgroundTask = generateContentInBatches(
        openAIApiKey,
        supabaseUrl,
        supabaseServiceKey,
        type
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
        pending_count: count || 0,
        message: count && count > 0 
          ? `Generating content for ${count} entries in batches of 10. This will take approximately ${Math.ceil(count / 10)} minutes.`
          : 'No pending entries found to generate content for.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fill-wiki-content function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
