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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&[a-z]+;/gi, '') // Remove other HTML entities
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/`(.+?)`/g, '$1') // Remove code
    .replace(/\n\n+/g, ' ') // Replace multiple newlines with space
    .replace(/\n/g, ' ') // Replace newlines with space
    .trim();
}

// 마크다운을 HTML로 변환
function markdownToHtml(markdown: string): string {
  return markdown
    // 헤더 변환 (## -> h2, ### -> h3 등)
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // 굵은 글씨
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 기울임
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 링크
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // 리스트 항목 (- 또는 *)
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    // 숫자 리스트
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // 인라인 코드
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 줄바꿈 (빈 줄은 단락 구분)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // 전체를 p 태그로 감싸기
    .replace(/^(.+)$/s, '<p>$1</p>')
    // li 태그들을 ul로 감싸기
    .replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');
}

function generateHTML(entry: any, creator: any): string {
  const title = decodeHtmlEntities(entry.title || 'KTRENDZ Wiki Entry');
  
  // Content를 plain text로 변환 (HTML 엔티티 디코딩 -> HTML 태그 제거 -> 마크다운 제거)
  let plainContent = decodeHtmlEntities(entry.content || '');
  plainContent = stripHtml(plainContent);
  plainContent = stripMarkdown(plainContent);
  const description = plainContent.substring(0, 160) || 'Explore K-TRENDZ wiki';
  
  // OG 이미지: image_url 사용 (og_image_url은 존재하지 않을 수 있음)
  const imageUrl = entry.image_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1762059273450-og_kt.png';
  const wikiUrl = `https://k-trendz.com/k/${entry.slug || entry.id}`;
  const creatorName = creator?.display_name || creator?.username || 'K-TRENDZ Community';
  
  // Schema type labels for breadcrumb
  const schemaTypeLabels: { [key: string]: string } = {
    actor: 'Actors',
    member: 'Members',
    group: 'Groups',
    artist: 'Artists',
    song: 'Songs',
    album: 'Albums',
    brand: 'Brands',
    product: 'Products',
    company: 'Companies',
    expert: 'Experts',
    other: 'Other',
  };
  const categoryLabel = entry.schema_type ? schemaTypeLabels[entry.schema_type] || 'Entries' : 'Entries';
  
  // Schema.org 구조화된 데이터 생성
  const schemaType = entry.schema_type === 'person' || entry.schema_type === 'actor' || entry.schema_type === 'member' 
    ? 'Person' 
    : entry.schema_type === 'group' 
    ? 'Organization' 
    : 'Thing';
  
  const structuredData: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": title,
    "description": description,
    "image": imageUrl,
    "url": wikiUrl,
  };
  
  // Person 타입일 경우 추가 정보
  if (schemaType === 'Person' && entry.metadata) {
    if (entry.metadata.birthday) {
      structuredData["birthDate"] = entry.metadata.birthday;
    }
    if (entry.metadata.nationality) {
      structuredData["nationality"] = entry.metadata.nationality;
    }
  }
  
  // Breadcrumb structured data
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "KTrendz",
        "item": "https://k-trendz.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Fanz",
        "item": "https://k-trendz.com/wiki"
      },
      ...(entry.schema_type ? [{
        "@type": "ListItem",
        "position": 3,
        "name": categoryLabel,
        "item": `https://k-trendz.com/wiki?type=${entry.schema_type}`
      }] : []),
      {
        "@type": "ListItem",
        "position": entry.schema_type ? 4 : 3,
        "name": title,
        "item": wikiUrl
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${wikiUrl}" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${wikiUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />
  <meta property="og:site_name" content="KTRENDZ" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title}" />
  
  <!-- JSON-LD structured data -->
  <script type="application/ld+json">
  ${JSON.stringify(structuredData, null, 2)}
  </script>
  
  <!-- Breadcrumb structured data -->
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbList, null, 2)}
  </script>
  
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
      color: #ff4500;
      margin-bottom: 10px;
    }
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      background: #f0f0f0;
      padding: 4px 8px;
      border-radius: 4px;
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
    .redirect-message {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
  </style>
  
  <!-- No redirect - serve SSR content for all users -->
</head>
<body>
  <noscript>
    <div class="redirect-message">
      <strong>Note:</strong> You are viewing a search engine optimized version. 
      <a href="${wikiUrl}">Click here for the full interactive experience</a>
    </div>
  </noscript>
  
  <!-- Breadcrumb Navigation -->
  <nav aria-label="Breadcrumb" style="margin-bottom: 20px; font-size: 14px; color: #666;">
    <a href="https://k-trendz.com" style="color: #ff4500; text-decoration: none;">KTrendz</a>
    <span style="margin: 0 8px;">&rsaquo;</span>
    <a href="https://k-trendz.com/wiki" style="color: #ff4500; text-decoration: none;">Fanz</a>
    ${entry.schema_type ? `
      <span style="margin: 0 8px;">&rsaquo;</span>
      <a href="https://k-trendz.com/wiki?type=${entry.schema_type}" style="color: #ff4500; text-decoration: none;">${categoryLabel}</a>
    ` : ''}
    <span style="margin: 0 8px;">&rsaquo;</span>
    <span style="color: #333; font-weight: 500;">${title}</span>
  </nav>
  
  <article>
    ${entry.image_url ? `<img src="${entry.image_url}" alt="${title}" />` : ''}
    
    <h1>${title}</h1>
    <div class="meta">
      ${entry.is_verified ? '<span class="badge">&#10003; Verified</span>' : ''}
      ${entry.schema_type ? `<span class="badge">${entry.schema_type}</span>` : ''}
      Created by ${creatorName} &bull; ${new Date(entry.created_at).toLocaleDateString()}
      ${entry.votes ? ` &bull; ${entry.votes} votes` : ''}
      ${entry.follower_count ? ` &bull; ${entry.follower_count} followers` : ''}
    </div>
    
    <div class="content">
      ${markdownToHtml(decodeHtmlEntities(entry.content || ''))}
    </div>
    
    ${entry.metadata && Object.keys(entry.metadata).length > 0 ? `
      <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
        <h2 style="font-size: 18px; margin-bottom: 10px;">Additional Information</h2>
        ${entry.metadata.birthday ? `<p><strong>Birthday:</strong> ${entry.metadata.birthday}</p>` : ''}
        ${entry.metadata.nationality ? `<p><strong>Nationality:</strong> ${entry.metadata.nationality}</p>` : ''}
        ${entry.metadata.debut_date ? `<p><strong>Debut:</strong> ${entry.metadata.debut_date}</p>` : ''}
        ${entry.metadata.company ? `<p><strong>Company:</strong> ${entry.metadata.company}</p>` : ''}
      </div>
    ` : ''}
  </article>
  
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
    <p><a href="https://k-trendz.com">&larr; Back to KTRENDZ</a></p>
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
    const entryId = url.searchParams.get('id');
    const userAgent = req.headers.get('user-agent') || '';
    const isBotUserAgent = isBot(userAgent);

    console.log('Request:', { entryId, userAgent, isBot: isBotUserAgent });

    if (!entryId) {
      return new Response('Wiki entry ID required', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // 모든 요청에 SEO HTML 반환 (OG 태그 포함)
    // 봇이 아닌 사용자는 클라이언트 측 JavaScript로 SPA 리다이렉트됨
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 위키 엔트리 조회 (slug 또는 id로)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId);
    let query;
    if (isUUID) {
      query = supabase
        .from('wiki_entries')
        .select('*, profiles!wiki_entries_creator_id_fkey(*)')
        .eq('id', entryId)
        .single();
    } else {
      query = supabase
        .from('wiki_entries')
        .select('*, profiles!wiki_entries_creator_id_fkey(*)')
        .eq('slug', entryId)
        .single();
    }

    const { data: entry, error: entryError } = await query;

    if (entryError || !entry) {
      console.error('Wiki entry fetch error:', entryError);
      return new Response('Wiki entry not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const html = generateHTML(entry, entry.profiles);

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
