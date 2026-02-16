import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HTML 엔티티 디코딩 함수
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  
  return text
    // 숫자형 엔티티 (&#숫자;)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // 16진수 엔티티 (&#x16진수;)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // 일반적인 이름 엔티티
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&middot;/g, '\u00B7')
    .replace(/&bull;/g, '\u2022')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&prime;/g, '\u2032')
    .replace(/&Prime;/g, '\u2033')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&amp;/g, '&'); // 마지막에 처리
};

// 본문 추출 함수
const extractArticleContent = (html: string): string => {
  // script와 style 태그만 제거 (너무 많이 제거하지 않도록)
  let cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // article 태그 내용 추출 시도
  const articleMatch = cleanedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let content = '';

  if (articleMatch) {
    content = articleMatch[1];
  } else {
    // article 태그가 없으면 main 태그에서 시도
    const mainMatch = cleanedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      content = mainMatch[1];
    } else {
      // main도 없으면 전체 body에서 추출
      const bodyMatch = cleanedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : cleanedHtml;
    }
  }

  // p 태그들과 div 태그들에서 텍스트 추출
  const paragraphs: string[] = [];
  
  // p 태그 우선
  const pMatches = content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of pMatches) {
    let text = match[1]
      .replace(/<[^>]+>/g, '') // HTML 태그 제거
      .replace(/\s+/g, ' ')     // 여러 공백을 하나로
      .trim();
    
    text = decodeHtmlEntities(text);
    
    if (text.length > 20) {
      paragraphs.push(text);
    }
  }

  // p 태그가 충분하지 않으면 div 태그도 시도
  if (paragraphs.length < 3) {
    const divMatches = content.matchAll(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    for (const match of divMatches) {
      let text = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      text = decodeHtmlEntities(text);
      
      if (text.length > 20 && !paragraphs.includes(text)) {
        paragraphs.push(text);
      }
    }
  }

  // 문단들을 합쳐서 반환 (최대 2000자)
  const fullText = paragraphs.join('\n\n');
  return fullText.length > 2000 ? fullText.substring(0, 2000) + '...' : fullText;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching metadata for URL:', url);

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KTRENDZ-Bot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract Open Graph meta tags
    const getMetaContent = (property: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    };

    // Extract title
    let title = getMetaContent('og:title') || 
                getMetaContent('twitter:title');
    
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1] : '';
    }

    // Extract description
    const description = getMetaContent('og:description') || 
                       getMetaContent('twitter:description') ||
                       getMetaContent('description') || '';

    // Extract image
    const image = getMetaContent('og:image') || 
                 getMetaContent('twitter:image') || '';

    // Extract article content
    const articleContent = extractArticleContent(html);
    
    // 본문이 있으면 본문 사용, 없으면 description 사용
    const content = articleContent || description;

    console.log('Extracted metadata:', { 
      title, 
      description, 
      contentLength: content.length,
      image 
    });

    return new Response(
      JSON.stringify({
        title: decodeHtmlEntities(title.trim()),
        description: decodeHtmlEntities(content.trim()),
        image: decodeHtmlEntities(image.trim()),
        sourceUrl: url,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error extracting metadata:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to extract metadata',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});