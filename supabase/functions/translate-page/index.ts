// 페이지 번역 Edge Function (DB 캐시 적용)
// 번역 결과를 translation_cache 테이블에 저장하여 API 비용 절감

import { createClient } from "npm:@supabase/supabase-js@2.78.0";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// 언어 코드를 사람이 읽을 수 있는 이름으로 변환
const languageNames: Record<string, string> = {
  ko: 'Korean', ja: 'Japanese', zh: 'Chinese', es: 'Spanish', fr: 'French',
  de: 'German', pt: 'Portuguese', it: 'Italian', ru: 'Russian', ar: 'Arabic',
  hi: 'Hindi', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
  tr: 'Turkish', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', da: 'Danish',
  fi: 'Finnish', nb: 'Norwegian', uk: 'Ukrainian', cs: 'Czech', ro: 'Romanian',
  hu: 'Hungarian', el: 'Greek', he: 'Hebrew', bn: 'Bengali', tl: 'Filipino',
};

// 간단한 해시 생성 (source_text 기반)
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  // 충돌 방지를 위해 텍스트 길이도 포함
  return `${hash.toString(36)}_${text.length}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segments, targetLanguage } = await req.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!targetLanguage || targetLanguage === 'en') {
      const translations: Record<string, string> = {};
      segments.forEach((s: any) => { translations[s.key] = s.text; });
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. 각 세그먼트의 해시 계산
    const segmentHashes: Record<string, string> = {};
    const segmentTexts: Record<string, string> = {};
    segments.forEach((s: any) => {
      const hash = simpleHash(s.text);
      segmentHashes[s.key] = hash;
      segmentTexts[s.key] = s.text;
    });

    // 2. DB에서 캐시된 번역 조회
    const allHashes = [...new Set(Object.values(segmentHashes))];
    const { data: cached } = await supabaseAdmin
      .from('translation_cache')
      .select('source_hash, translated_text')
      .eq('target_language', targetLanguage)
      .in('source_hash', allHashes);

    const cacheMap: Record<string, string> = {};
    (cached || []).forEach((c: any) => {
      cacheMap[c.source_hash] = c.translated_text;
    });

    // 3. 캐시 히트/미스 분류
    const translations: Record<string, string> = {};
    const uncachedSegments: Record<string, string> = {};

    for (const [key, hash] of Object.entries(segmentHashes)) {
      if (cacheMap[hash]) {
        translations[key] = cacheMap[hash];
      } else {
        uncachedSegments[key] = segmentTexts[key];
      }
    }

    const cachedCount = Object.keys(translations).length;
    const uncachedCount = Object.keys(uncachedSegments).length;
    console.log(`Cache: ${cachedCount} hit, ${uncachedCount} miss for ${targetLanguage}`);

    // 4. 미번역 세그먼트만 OpenAI에 요청
    if (uncachedCount > 0) {
      if (!openAIApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }

      const langName = languageNames[targetLanguage] || targetLanguage;

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
              content: `You are a professional translator specializing in natural, idiomatic ${langName} translations.

TRANSLATION STYLE:
- Write as if a native ${langName} speaker originally wrote the text — NOT as a word-for-word translation from English.
- Use natural sentence structures, word order, and expressions that native speakers actually use in everyday conversation.
- For Korean specifically: use casual-polite speech (해요체) by default; prefer native Korean words (순우리말) over Sino-Korean (한자어) when both sound natural; avoid stiff, formal, or robotic phrasing.
- For Japanese: use です/ます form; prefer natural colloquial expressions over literal translations.
- Adapt idioms and expressions to their local equivalents rather than translating literally.

OUTPUT FORMAT:
- Return a JSON object with the SAME keys but translated values.
- Preserve markdown formatting if present.

DO NOT TRANSLATE (keep exactly as-is):
- Proper nouns: artist names, group names, brand names, usernames
- Technical terms and product names (e.g., "Bot Club", "KTRENDZ")
- Agent name prefixes in brackets like [AgentName]
- Currency amounts ($0.0234, $100), percentages (+5.2%, -3.1%)
- Emoji characters
- Supply numbers and statistics
- URLs, links, token/coin symbols (USDC, ETH, KTNZ)

SPECIAL TERMS:
- "Lightstick" / "Lightsticks" → localized equivalent (Korean: "응원봉", Japanese: "ペンライト")
- "Fan Token" → keep as "팬 토큰" (Korean) or localized equivalent
- "Stars" (currency) → "스타" (Korean) or localized equivalent

If a value is already in ${langName}, return it unchanged.
Do NOT translate keys, only values.`
            },
            {
              role: 'user',
              content: JSON.stringify(uncachedSegments)
            }
          ],
          max_tokens: 16000,
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
      const newTranslations = JSON.parse(data.choices[0].message.content);

      // 5. 새 번역 결과를 DB에 저장하고 응답에 병합
      const insertRows: any[] = [];
      for (const [key, translatedText] of Object.entries(newTranslations)) {
        translations[key] = translatedText as string;
        const hash = segmentHashes[key];
        if (hash) {
          insertRows.push({
            source_hash: hash,
            target_language: targetLanguage,
            source_text: segmentTexts[key],
            translated_text: translatedText as string,
          });
        }
      }

      // 중복 무시하며 일괄 삽입
      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('translation_cache')
          .upsert(insertRows, { onConflict: 'source_hash,target_language' });

        if (insertError) {
          console.error('Cache save error:', insertError.message);
        } else {
          console.log(`Cached ${insertRows.length} new translations`);
        }
      }
    }

    console.log(`Translation complete: ${Object.keys(translations).length} segments`);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in translate-page function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
