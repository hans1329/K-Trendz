import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HTML 태그 제거 함수
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&nbsp;/g, ' ') // &nbsp; 제거
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ') // 연속 공백을 하나로
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content } = await req.json();

    console.log('Translating to English:', { title, content: content.substring(0, 200) + '...' });

    // HTML 태그 제거
    const cleanTitle = stripHtml(title || '');
    const cleanContent = stripHtml(content || '');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

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
            content: `You are a Korean to English translator. Translate ALL Korean text to English.
CRITICAL RULES:
1. ALWAYS translate both title AND content fields
2. Return plain text in English only (no HTML tags)
3. Return JSON with "title" and "content" fields
4. If input is already in English, return it unchanged
5. Maintain natural, readable English

Example:
Input: {"title":"콜미진","content":"토론토에서 육아와 일을 병행하는 여성의 이야기"}
Output: {"title":"CallMeJin","content":"A story of a woman raising kids and working in Toronto"}` 
          },
          { 
            role: 'user', 
            content: `Translate this to English:\nTitle: ${cleanTitle}\nContent: ${cleanContent}` 
          }
        ],
        max_tokens: 8000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content;
    const translated = JSON.parse(translatedText);

    console.log('Translation successful', translated);

    // Remove any "Title:" or "Content:" prefixes
    const finalTitle = (translated.title || cleanTitle).replace(/^Title:\s*/i, '').trim();
    const finalContent = (translated.content || cleanContent).replace(/^Content:\s*/i, '').trim();

    return new Response(JSON.stringify({ 
      title: finalTitle,
      content: finalContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in translate-to-english function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
