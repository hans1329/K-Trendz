import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 봇 User-Agent 패턴
const BOT_PATTERNS = [
  'bot',
  'crawler',
  'spider',
  'googlebot',
  'google-inspectiontool', // Google Search Console URL Inspection
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegram',
  'telegrambot',
  'kakao',
  'kakaotalk',
  'kakaotalkbot',
  'naverbot',
  'daumoa',
  'slackbot',
  'discordbot',
  'pinterest',
  'tumblr',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&nbsp;': ' ',
  };
  return text.replace(/&[^;]+;/g, match => entities[match] || match);
}

// HTML 속성에서 사용할 수 있도록 특수문자 이스케이프
function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 스마트 따옴표도 이스케이프
    .replace(/"/g, '&ldquo;')
    .replace(/"/g, '&rdquo;')
    .replace(/'/g, '&lsquo;')
    .replace(/'/g, '&rsquo;');
}

function stripHtmlTags(html: string): string {
  // HTML 태그 제거
  let text = html.replace(/<[^>]*>/g, ' ');
  // 연속된 공백을 하나로
  text = text.replace(/\s+/g, ' ');
  // 앞뒤 공백 제거
  return text.trim();
}

function generateDescription(post: any, wikiEntry: any): string {
  const plainTextContent = stripHtmlTags(post.content || '');
  let description = decodeHtmlEntities(plainTextContent);
  
  // content가 URL만 있거나 빈약한 경우 (150자 미만)
  if (description.length < 150) {
    const parts: string[] = [];
    
    // 기존 content가 있으면 추가
    if (description.trim() && !description.startsWith('http')) {
      parts.push(description.trim());
    }
    
    // wiki entry 정보 추가
    if (wikiEntry) {
      const wikiContent = stripHtmlTags(wikiEntry.content || '');
      if (wikiContent) {
        parts.push(`Related to ${wikiEntry.title}: ${wikiContent.substring(0, 200)}`);
      }
      
      // metadata에서 추가 정보
      if (wikiEntry.metadata) {
        const meta = wikiEntry.metadata;
        if (meta.debut_date) parts.push(`Debut: ${meta.debut_date}`);
        if (meta.company) parts.push(`Company: ${meta.company}`);
      }
    }
    
    // 카테고리 정보
    if (post.category) {
      parts.push(`Category: ${post.category}`);
    }
    
    // 커뮤니티 정보
    if (post.communities?.name) {
      parts.push(`Community: ${post.communities.name}`);
    }
    
    description = parts.join(' | ');
  }
  
  // 최소 150자 보장, 최대 300자
  if (description.length < 150) {
    description += ' | KTRENDZ is the ultimate fan community platform for K-Pop and K-Culture enthusiasts. Create fan pages, collect lightstick tokens, and connect with fans worldwide.';
  }
  
  return description.substring(0, 300);
}

function generateHTML(post: any, author: any, wikiEntry: any): string {
  const rawTitle = decodeHtmlEntities(post.title || 'KTRENDZ Post');
  const rawDescription = generateDescription(post, wikiEntry);
  
  // HTML 속성에 안전하게 사용할 수 있도록 이스케이프
  const title = escapeHtmlAttribute(rawTitle);
  const description = escapeHtmlAttribute(rawDescription);
  const imageUrl = post.image_url || wikiEntry?.image_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png';
  const postUrl = post.slug ? `https://k-trendz.com/p/${post.slug}` : `https://k-trendz.com/post/${post.id}`;
  const authorName = escapeHtmlAttribute(author?.display_name || author?.username || 'Anonymous');
  
  // 풍부한 컨텍스트 생성
  const categoryBadge = post.category ? `<span class="badge">${escapeHtmlAttribute(post.category)}</span>` : '';
  const communityBadge = post.communities?.name ? `<span class="badge">${escapeHtmlAttribute(post.communities.name)}</span>` : '';
  const wikiTitle = wikiEntry ? escapeHtmlAttribute(wikiEntry.title) : '';
  const wikiLink = wikiEntry ? `<a href="https://k-trendz.com/k/${wikiEntry.id}" class="related-link">Related: ${wikiTitle}</a>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | KTRENDZ</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${postUrl}" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${postUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />
  <meta property="og:site_name" content="KTRENDZ" />
  <meta property="article:published_time" content="${post.created_at}" />
  <meta property="article:author" content="${authorName}" />
  ${wikiEntry ? `<meta property="article:tag" content="${wikiTitle}" />` : ''}
  ${post.category ? `<meta property="article:section" content="${escapeHtmlAttribute(post.category)}" />` : ''}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title}" />
  
  <link rel="icon" type="image/x-icon" href="https://k-trendz.com/favicon.ico">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #c13400;
      margin-bottom: 10px;
    }
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .badges {
      margin-bottom: 15px;
    }
    .badge {
      display: inline-block;
      background: #f0f0f0;
      color: #666;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      margin-right: 8px;
    }
    .content {
      margin-top: 20px;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }
    .related-link {
      display: block;
      margin-top: 20px;
      padding: 12px 16px;
      background: #fff5f0;
      border-left: 4px solid #c13400;
      color: #c13400;
      text-decoration: none;
      border-radius: 0 8px 8px 0;
    }
    .related-link:hover {
      background: #ffe8e0;
    }
    .wiki-context {
      margin-top: 20px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .wiki-context h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #333;
    }
    .wiki-context p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
    .redirect-message {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <noscript>
    <div class="redirect-message">
      <strong>Note:</strong> You are viewing a search engine optimized version. 
      <a href="${postUrl}">Click here for the full interactive experience</a>
    </div>
  </noscript>
  
  <article>
    <h1>${title}</h1>
    
    <div class="badges">
      ${categoryBadge}
      ${communityBadge}
    </div>
    
    <div class="meta">
      By ${authorName} • ${new Date(post.created_at).toLocaleDateString()} • ${post.votes || 0} votes • ${post.view_count || 0} views
    </div>
    
    ${post.image_url ? `<img src="${post.image_url}" alt="${title}" />` : ''}
    
    <div class="content">
      ${decodeHtmlEntities(post.content || '')}
    </div>
    
    ${post.source_url ? `<p><a href="${post.source_url}" target="_blank" rel="noopener noreferrer">Source: ${post.source_url}</a></p>` : ''}
    
    ${wikiLink}
    
    ${wikiEntry ? `
    <div class="wiki-context">
      <h3>About ${wikiEntry.title}</h3>
      <p>${stripHtmlTags(wikiEntry.content || '').substring(0, 300)}...</p>
    </div>
    ` : ''}
  </article>
  
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
    <p><a href="https://k-trendz.com">← Back to KTRENDZ</a> | <a href="https://k-trendz.com/wiki">Browse Fan Pages</a></p>
  </footer>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const identifier = url.searchParams.get('id'); // id 또는 slug
    const userAgent = req.headers.get('user-agent') || '';
    const isBotUserAgent = isBot(userAgent);

    console.log('Request:', { identifier, userAgent, isBot: isBotUserAgent });

    if (!identifier) {
      return new Response('Post ID or slug required', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // UUID 패턴 체크
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(identifier);

    let post = null;
    let postError = null;

    if (isUuid) {
      // UUID인 경우 id로 조회
      const result = await supabase
        .from('posts')
        .select('*, profiles(*), communities(*)')
        .eq('id', identifier)
        .maybeSingle();
      post = result.data;
      postError = result.error;
    } else {
      // slug로 조회
      const result = await supabase
        .from('posts')
        .select('*, profiles(*), communities(*)')
        .eq('slug', identifier)
        .maybeSingle();
      post = result.data;
      postError = result.error;

      // slug로 못 찾으면 앞 8자리로 like 검색 (잘린 URL 대응)
      if (!post && identifier.length >= 8) {
        const shortId = identifier.substring(0, 8);
        const likeResult = await supabase
          .from('posts')
          .select('*, profiles(*), communities(*)')
          .like('slug', `${shortId}%`)
          .maybeSingle();
        post = likeResult.data;
        postError = likeResult.error;
      }
    }

    if (postError || !post) {
      console.error('Post fetch error:', postError, 'identifier:', identifier);
      return new Response('Post not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Fetch related wiki entry if exists
    let wikiEntry = null;
    if (post.wiki_entry_id) {
      const { data: wiki } = await supabase
        .from('wiki_entries')
        .select('id, title, content, image_url, metadata, schema_type')
        .eq('id', post.wiki_entry_id)
        .single();
      wikiEntry = wiki;
    }

    const html = generateHTML(post, post.profiles, wikiEntry);

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
    responseHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=600');

    return new Response(html, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
