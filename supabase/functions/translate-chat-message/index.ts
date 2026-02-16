import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, targetLanguage } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ 
        translatedMessage: message,
        originalLanguage: 'en'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Translating message:', message.substring(0, 100));

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Step 1: 영어로 번역 (저장용)
    const translateToEnglishResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a translator. Detect the input language and translate to English.
Return JSON with:
- "translated": the English translation
- "originalLanguage": the detected language code (e.g., "ko", "ja", "zh", "en", "es", etc.)

If already in English, return the original text and "en" as the language.
Keep the translation natural and conversational.` 
          },
          { 
            role: 'user', 
            content: message 
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!translateToEnglishResponse.ok) {
      const errorData = await translateToEnglishResponse.text();
      console.error('OpenAI API error:', translateToEnglishResponse.status, errorData);
      throw new Error(`OpenAI API error: ${translateToEnglishResponse.status}`);
    }

    const translateData = await translateToEnglishResponse.json();
    const translateResult = JSON.parse(translateData.choices[0].message.content);
    
    const englishMessage = translateResult.translated || message;
    const originalLanguage = translateResult.originalLanguage || 'en';

    console.log('Translation result:', { originalLanguage, englishMessage: englishMessage.substring(0, 50) });

    // Step 2: 타겟 언어로 번역 (표시용)
    let displayMessage = englishMessage;
    
    if (targetLanguage && targetLanguage !== 'en') {
      const displayResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `Translate the following English text to ${targetLanguage}. Return only the translated text, nothing else. Keep it natural and conversational.` 
            },
            { 
              role: 'user', 
              content: englishMessage 
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (displayResponse.ok) {
        const displayData = await displayResponse.json();
        displayMessage = displayData.choices[0].message.content.trim();
      }
    }

    return new Response(JSON.stringify({ 
      translatedMessage: englishMessage,
      displayMessage: displayMessage,
      originalLanguage: originalLanguage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in translate-chat-message function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
