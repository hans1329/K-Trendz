import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch from Wikipedia with timeout
async function fetchFromWikipedia(title: string, lang: string = 'en') {
  try {
    const encodedTitle = encodeURIComponent(title);
    // Use mobile-sections API for full content
    const sectionsUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/mobile-sections/${encodedTitle}`;
    
    console.log(`[WIKIPEDIA] Fetching from ${sectionsUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(sectionsUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KTRENDZ-WikiBot/1.0; +https://ktrendz.xyz)',
          'Api-User-Agent': 'KTRENDZ-WikiBot/1.0 (https://ktrendz.xyz; contact@ktrendz.xyz)',
          'Accept': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`[WIKIPEDIA] ${lang} failed (status ${response.status}) for: ${title}`);
        return null;
      }

      const data = await response.json();
      
      console.log(`[WIKIPEDIA] Response for ${title}:`, {
        hasLead: !!data.lead,
        hasRemaining: !!data.remaining,
        leadSectionsCount: data.lead?.sections?.length || 0,
        remainingSectionsCount: data.remaining?.sections?.length || 0,
      });
      
      // Check if it's a disambiguation page
      if (data.lead?.description?.toLowerCase().includes('disambiguation')) {
        console.log(`[WIKIPEDIA] Disambiguation page for: ${title}`);
        return null;
      }

      // Check if we have actual content
      if (!data.lead && !data.remaining) {
        console.log(`[WIKIPEDIA] No content for: ${title}`);
        return null;
      }

      return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        console.log(`[WIKIPEDIA] Timeout for: ${title}`);
      } else {
        throw fetchError;
      }
      return null;
    }
  } catch (error) {
    console.error(`[WIKIPEDIA] Error fetching ${title} from ${lang}:`, error);
    return null;
  }
}

// Helper function to fetch wiki content from Namuwiki
async function fetchFromNamuwiki(title: string): Promise<any> {
  try {
    const namuwikiUrl = `https://namu.wiki/w/${encodeURIComponent(title)}`;
    console.log(`[NAMUWIKI] Fetching content from: ${namuwikiUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(namuwikiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`[NAMUWIKI] Failed (status ${response.status}) for: ${title}`);
        return null;
      }
      
      const html = await response.text();
      
      // Extract content from Namuwiki HTML
      // Namuwiki uses a specific structure - we'll extract the main content
      const contentMatch = html.match(/<div[^>]*class="wiki-content"[^>]*>(.*?)<\/div>/s);
      if (!contentMatch) {
        console.log(`[NAMUWIKI] No content found for: ${title}`);
        return null;
      }
      
      let content = contentMatch[1];
      
      // Clean up HTML
      content = content
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<a[^>]*href="[^"]*"[^>]*>(.*?)<\/a>/gi, '$1')
        .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
        .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, level, text) => {
          const hashes = '#'.repeat(parseInt(level));
          return `\n${hashes} ${text}\n`;
        })
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      
      if (content.length < 100) {
        console.log(`[NAMUWIKI] Content too short for: ${title}`);
        return null;
      }
      
      console.log(`[NAMUWIKI] Successfully fetched content for: ${title} (${content.length} chars)`);
      
      return {
        title: title,
        content: content,
        source: 'namu.wiki'
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        console.log(`[NAMUWIKI] Timeout for: ${title}`);
      } else {
        throw fetchError;
      }
      return null;
    }
  } catch (error) {
    console.error(`[NAMUWIKI] Error fetching ${title}:`, error);
    return null;
  }
}

// Helper function to fetch social links from Namuwiki
async function fetchSocialLinks(title: string): Promise<any> {
  try {
    const namuwikiUrl = `https://namu.wiki/w/${encodeURIComponent(title)}`;
    let socialLinks: any = {};
    
    console.log(`[SOCIAL] Fetching social links for: ${title}`);
    
    const namuwikiResponse = await fetch(namuwikiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!namuwikiResponse.ok) {
      console.log(`[SOCIAL] Namuwiki not found for: ${title}`);
      return {};
    }
    
    const html = await namuwikiResponse.text();
    const bodyText = html;
    
    // Instagram
    const igPatterns = [
      /instagram\.com\/([a-zA-Z0-9._]+)/gi,
      /www\.instagram\.com\/([a-zA-Z0-9._]+)/gi,
      /@([a-zA-Z0-9._]+).*instagram/gi
    ];
    
    for (const pattern of igPatterns) {
      const matches = bodyText.matchAll(pattern);
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
      const matches = bodyText.matchAll(pattern);
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
      /youtu\.be\/([^\/\?\s"'<>]+)/gi
    ];
    
    for (const pattern of ytPatterns) {
      const matches = bodyText.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          const channelId = `${match[1]}${match[2]}`;
          socialLinks.youtube = {
            url: `https://youtube.com/${channelId}`,
            verified: true
          };
          break;
        } else if (match[1]) {
          socialLinks.youtube = {
            url: `https://youtube.com/watch?v=${match[1]}`,
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
      const matches = bodyText.matchAll(pattern);
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
    
    const linkCount = Object.keys(socialLinks).length;
    if (linkCount > 0) {
      console.log(`[SOCIAL] Found ${linkCount} social links for: ${title}`);
    } else {
      console.log(`[SOCIAL] No social links found for: ${title}`);
    }
    
    return socialLinks;
  } catch (error) {
    console.error(`[SOCIAL] Error fetching social links for ${title}:`, error);
    return {};
  }
}

// Helper function to extract birthday from Wikipedia content
async function extractBirthdayFromContent(wikiData: any): Promise<string | null> {
  try {
    // Get text from lead section
    const leadText = wikiData.lead?.sections?.[0]?.text || '';
    
    // Common birthday patterns
    const patterns = [
      /born[:\s]+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      /(\d{4})[년-](\d{1,2})[월-](\d{1,2})/,
    ];
    
    for (const pattern of patterns) {
      const match = leadText.match(pattern);
      if (match) {
        if (match[1] && match[2] && match[3]) {
          // Month name format
          const months: { [key: string]: string } = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };
          const month = months[match[2].toLowerCase()];
          const day = match[1].padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        } else if (match.length === 4) {
          // Korean format YYYY-MM-DD
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[BIRTHDAY] Error extracting birthday:', error);
    return null;
  }
}


// Helper function to convert Wikipedia mobile-sections to markdown
function convertToMarkdown(wikiData: any): string {
  let markdown = `# ${wikiData.lead?.displaytitle || wikiData.lead?.normalizedtitle || 'Unknown'}\n\n`;
  
  // Add image if available
  if (wikiData.lead?.image?.urls?.['640']) {
    const imageUrl = wikiData.lead.image.urls['640'];
    markdown += `![${wikiData.lead.displaytitle}](https:${imageUrl})\n\n`;
  }
  
  // Add lead section (intro)
  if (wikiData.lead?.sections?.[0]?.text) {
    let leadText = wikiData.lead.sections[0].text;
    leadText = leadText
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<a[^>]*href="\/wiki\/[^"]*"[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\d+\]/g, '')
      .replace(/\[citation needed\]/gi, '')
      .replace(/\[edit\]/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();
    
    if (leadText) {
      markdown += `${leadText}\n\n`;
    }
  }
  
  // Add remaining sections
  if (wikiData.remaining?.sections) {
    for (const section of wikiData.remaining.sections) {
      const sectionTitle = section.line || section.anchor;
      
      // Skip unwanted sections
      if (!sectionTitle || 
          sectionTitle.match(/see also|references|external links|notes|further reading|bibliography|각주|같이 보기|외부 링크|참고 문헌/i)) {
        continue;
      }
      
      markdown += `## ${sectionTitle}\n\n`;
      
      if (section.text) {
        let sectionText = section.text;
        sectionText = sectionText
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<style[^>]*>.*?<\/style>/gi, '')
          .replace(/<a[^>]*href="\/wiki\/[^"]*"[^>]*>(.*?)<\/a>/gi, '$1')
          .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\[\d+\]/g, '')
          .replace(/\[citation needed\]/gi, '')
          .replace(/\[edit\]/gi, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .trim();
        
        if (sectionText) {
          markdown += `${sectionText}\n\n`;
        }
      }
    }
  }
  
  return markdown.trim();
}

// Generate content with AI using training data
async function generateWithAI(title: string, schemaType: string, openAIApiKey: string) {
  console.log(`[AI] Generating content for ${title} (${schemaType}) using training data`);
  
  const systemPrompt = `You are a K-pop/entertainment expert with comprehensive knowledge. Use your training data to provide accurate, detailed information.

CRITICAL ACCURACY RULES:
1. For group MEMBERS: List ALL members with stage names and real names
   - Do NOT skip any members
   - Verify the count is complete
2. For BIRTH DATES: Provide in YYYY-MM-DD format with 100% accuracy
   - Only include if certain of the date
3. Write comprehensive content in English markdown format`;

  const userPrompts: Record<string, string> = {
    artist: `Create a comprehensive wiki entry for the K-pop group "${title}".

REQUIRED:
1. **MEMBERS** (MOST CRITICAL): List ALL current members with:
   - Stage names and real names
   - Positions/roles in the group (Leader, Main Vocalist, Main Rapper, Main Dancer, etc.)
   - Birth dates if known
2. **GROUP INFO**: Debut date, Agency, Genre
3. **CAREER**: Major albums, Awards
4. **BIOGRAPHY**: 2-3 paragraphs about the group's history

Format as markdown with # title and ## headings.`,
    member: `Create a comprehensive wiki entry for "${title}".

REQUIRED:
1. **PERSONAL**: Real name, stage name, birth date (YYYY-MM-DD - must be accurate)
2. **GROUP**: Group affiliation (exact group name), position/role in the group
3. **CAREER**: Debut, achievements, solo activities
4. **BIOGRAPHY**: 2-3 paragraphs

Format as markdown with # title and ## headings.`,
    actor: `Create a comprehensive wiki entry for "${title}".

REQUIRED:
1. **PERSONAL**: Full name, birth date (YYYY-MM-DD - must be accurate)
2. **CAREER**: Notable works (dramas, movies), Awards
3. **BIOGRAPHY**: 2-3 paragraphs

Format as markdown with # title and ## headings.`
  };

  const userPrompt = userPrompts[schemaType] || 
    `Create a detailed wiki entry about "${title}" in English markdown format. Use # for title and ## for sections.`;
  
  const tools = [{
    type: "function",
    function: {
      name: "create_wiki_entry",
      description: "Create a structured wiki entry",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Wiki content in markdown format"
          },
          birthday: {
            type: "string",
            description: "Birth date in YYYY-MM-DD format (members/actors only)"
          },
          real_name: { type: "string" },
          stage_name: { type: "string" },
          members: {
            type: "array",
            description: "COMPLETE list of ALL members (for groups)",
            items: {
              type: "object",
              properties: {
                stage_name: { type: "string" },
                real_name: { type: "string" },
                birthday: { type: "string" },
                position: { type: "string", description: "Role/position in group (e.g., Leader, Main Vocalist, Main Rapper)" }
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
          debut_date: { type: "string" }
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
    throw new Error(`OpenAI API failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices[0].message.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error('No tool call returned from AI');
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log(`[AI] Generated data for ${title}:`, {
    contentLength: result.content?.length || 0,
    hasMembers: !!result.members,
    membersCount: result.members?.length || 0,
    membersList: result.members?.map((m: any) => `${m.stage_name}${m.real_name ? ` (${m.real_name})` : ''}`).join(', ') || 'none',
    hasBirthday: !!result.birthday,
    birthday: result.birthday || 'none'
  });
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, schemaType } = await req.json();
    
    console.log('Generating wiki content for:', title, schemaType);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Use AI training data to generate content
    const aiResult = await generateWithAI(title, schemaType, openAIApiKey);

    const generatedContent = aiResult.content;
    const metadata: any = {
      source: 'ai-training-data',
      ai_model: 'gpt-4o-mini',
      generation_date: new Date().toISOString()
    };

    // Add extracted metadata
    if (aiResult.birthday) {
      metadata.birthday = aiResult.birthday;
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
    if (aiResult.members && aiResult.members.length > 0) {
      metadata.members = aiResult.members;
      console.log(`[GENERATE] Extracted ${aiResult.members.length} members with positions`);
    }

    // member 타입이고 group_name이 있으면 자동으로 group_id 찾기
    if (schemaType === 'member' && aiResult.group_name) {
      console.log(`[GENERATE] Looking for group: ${aiResult.group_name}`);
      
      const { data: groupEntry } = await supabaseClient
        .from('wiki_entries')
        .select('id, title')
        .eq('schema_type', 'artist')
        .ilike('title', aiResult.group_name)
        .limit(1)
        .single();
      
      if (groupEntry) {
        metadata.group_id = groupEntry.id;
        console.log(`[GENERATE] Found group: ${groupEntry.title} (${groupEntry.id})`);
      } else {
        console.log(`[GENERATE] Group not found: ${aiResult.group_name}`);
      }
    }

    console.log(`[GENERATE] Successfully generated content with AI for ${title}`);
      
    return new Response(JSON.stringify({ 
      content: generatedContent,
      metadata: metadata,
      source: 'ai-training-data'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-wiki-content function:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('timed out')) {
        statusCode = 504;
      } else if (error.message.includes('Network connection lost')) {
        statusCode = 503;
      }
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: 'Please try again. If the issue persists, contact support.'
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
