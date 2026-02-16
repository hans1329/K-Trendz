// Sitemap Edge Function - Dynamic sitemap generation for SEO
// Version: 2025-11-08-v2 - Force cache clear
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema type 라벨 매핑
const SCHEMA_TYPE_LABELS: { [key: string]: string } = {
  'artist': 'K-Pop Artists',
  'group': 'Groups',
  'member': 'K-Pop Member',
  'actor': 'K-Actors',
  'album': 'Albums',
  'song': 'Songs',
  'movie': 'Movies',
  'drama': 'Dramas',
  'variety_show': 'Variety Shows',
  'event': 'Events',
  'beauty_brand': 'Beauty Brands',
  'beauty_product': 'Beauty Products',
  'restaurant': 'Restaurants',
  'food': 'K-Food',
  'food_brand': 'Food Brands',
  'food_product': 'Food Products',
  'brand': 'Brands'
};

// Sitemap index를 생성하는 함수 제거 - 대신 type 파라미터 없으면 완전한 sitemap 반환

function generateRankingsSitemap(): string {
  const currentDate = new Date().toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Rankings Page -->
  <url>
    <loc>https://k-trendz.com/rankings</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

  // 각 카테고리별 rankings 페이지 추가
  Object.entries(SCHEMA_TYPE_LABELS).forEach(([key, label]) => {
    const urlPath = label.toLowerCase().replace(/\s+/g, '-') + '-top-100';
    xml += `  <url>
    <loc>https://k-trendz.com/${urlPath}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
  });

  xml += `</urlset>`;
  return xml;
}

function generatePostsSitemap(posts: any[]): string {
  const currentDate = new Date().toISOString();
  const staticPages = [
    { loc: 'https://k-trendz.com/', priority: '1.0', changefreq: 'daily' },
    { loc: 'https://k-trendz.com/auth', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://k-trendz.com/create-post', priority: '0.7', changefreq: 'monthly' },
    { loc: 'https://k-trendz.com/mentions', priority: '0.6', changefreq: 'daily' },
    { loc: 'https://k-trendz.com/messages', priority: '0.6', changefreq: 'daily' },
    { loc: 'https://k-trendz.com/notifications', priority: '0.6', changefreq: 'daily' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // 정적 페이지
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  // 게시글 페이지
  posts.forEach(post => {
    const lastmod = new Date(post.updated_at || post.created_at).toISOString();
    const priority = post.is_pinned ? '0.9' : '0.7';
    // slug가 있으면 slug 사용, 없으면 id 사용
    const postPath = post.slug || post.id;
    
    xml += `  <url>
    <loc>https://k-trendz.com/p/${postPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  });

  xml += `</urlset>`;
  return xml;
}

function generateWikiSitemap(wikiEntries: any[]): string {
  const currentDate = new Date().toISOString();
  const staticPages = [
    { loc: 'https://k-trendz.com/k', priority: '0.9', changefreq: 'daily' },
    { loc: 'https://k-trendz.com/calendar', priority: '0.8', changefreq: 'daily' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // 정적 페이지
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  // Wiki 엔트리 - slug 사용
  wikiEntries.forEach(entry => {
    const lastmod = new Date(entry.updated_at || entry.created_at).toISOString();
    const priority = entry.is_verified ? '0.9' : '0.8';
    
    // slug가 있으면 slug 사용, 없으면 id 사용 (fallback)
    const urlPath = entry.slug || entry.id;
    
    xml += `  <url>
    <loc>https://k-trendz.com/k/${urlPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  });

  xml += `</urlset>`;
  return xml;
}

function generateEventsSitemap(events: any[]): string {
  const currentDate = new Date().toISOString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // 캘린더 이벤트
  events.forEach(event => {
    const lastmod = new Date(event.updated_at || event.created_at).toISOString();
    const eventDate = new Date(event.event_date);
    const today = new Date();
    // 미래 이벤트는 우선순위 높게
    const priority = eventDate >= today ? '0.8' : '0.6';
    
    xml += `  <url>
    <loc>https://k-trendz.com/event/${event.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  });

  xml += `</urlset>`;
  return xml;
}

function generateCommunitiesSitemap(communities: any[]): string {
  const currentDate = new Date().toISOString();
  const staticPages = [
    { loc: 'https://k-trendz.com/communities', priority: '0.9', changefreq: 'weekly' },
    { loc: 'https://k-trendz.com/earn', priority: '0.7', changefreq: 'weekly' },
    { loc: 'https://k-trendz.com/wallet', priority: '0.7', changefreq: 'weekly' },
    { loc: 'https://k-trendz.com/purchase', priority: '0.7', changefreq: 'weekly' },
    { loc: 'https://k-trendz.com/points-guide', priority: '0.6', changefreq: 'monthly' },
    { loc: 'https://k-trendz.com/whitepaper', priority: '0.6', changefreq: 'monthly' },
    { loc: 'https://k-trendz.com/privacy', priority: '0.5', changefreq: 'yearly' },
    { loc: 'https://k-trendz.com/terms', priority: '0.5', changefreq: 'yearly' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // 정적 페이지
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  // 커뮤니티 페이지
  communities.forEach(community => {
    const lastmod = new Date(community.updated_at || community.created_at).toISOString();
    const urlPath = community.slug || community.id; // slug 우선, 없으면 id
    
    xml += `  <url>
    <loc>https://k-trendz.com/c/${urlPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  });

  xml += `</urlset>`;
  return xml;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'index';
    
    console.log(`Generating sitemap: ${type}`);

    // 기본 요청 - sitemap index 반환
    if (!type || type === 'index') {
      const currentDate = new Date().toISOString();
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://auth.k-trendz.com/functions/v1/sitemap?type=posts</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://auth.k-trendz.com/functions/v1/sitemap?type=wiki</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://auth.k-trendz.com/functions/v1/sitemap?type=events</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://auth.k-trendz.com/functions/v1/sitemap?type=rankings</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`;

      // script 태그 제거
      xml = xml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      xml = xml.replace(/<script\s*\/?>/gi, '');
      xml = xml.replace(/<script>/gi, '');
      xml = xml.replace(/<\/script>/gi, '');

      return new Response(xml, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Supabase 클라이언트 생성

    // Supabase 클라이언트 생성 (posts, wiki, communities용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let xml = '';

    // 게시글 사이트맵
    if (type === 'posts') {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, slug, created_at, updated_at, is_pinned')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (postsError) {
        console.error('Posts database error:', postsError);
        throw postsError;
      }

      console.log(`Found ${posts?.length || 0} posts`);
      xml = generatePostsSitemap(posts || []);
    }
    // Wiki 사이트맵
    else if (type === 'wiki') {
      const { data: wikiEntries, error: wikiError } = await supabase
        .from('wiki_entries')
        .select('id, slug, created_at, updated_at, is_verified')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (wikiError) {
        console.error('Wiki database error:', wikiError);
        throw wikiError;
      }

      console.log(`Found ${wikiEntries?.length || 0} wiki entries`);
      xml = generateWikiSitemap(wikiEntries || []);
    }
    // 커뮤니티 사이트맵
    else if (type === 'communities') {
      const { data: communities, error: communitiesError } = await supabase
        .from('communities')
        .select('id, slug, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (communitiesError) {
        console.error('Communities database error:', communitiesError);
        throw communitiesError;
      }

      console.log(`Found ${communities?.length || 0} communities`);
      xml = generateCommunitiesSitemap(communities || []);
    }
    // 이벤트 사이트맵
    else if (type === 'events') {
      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('id, created_at, updated_at, event_date')
        .order('event_date', { ascending: false })
        .limit(10000);

      if (eventsError) {
        console.error('Events database error:', eventsError);
        throw eventsError;
      }

      console.log(`Found ${calendarEvents?.length || 0} calendar events`);
      xml = generateEventsSitemap(calendarEvents || []);
    }
    // Rankings 사이트맵
    else if (type === 'rankings') {
      console.log('Generating rankings sitemap');
      xml = generateRankingsSitemap();
    }
    else {
      throw new Error('Invalid sitemap type');
    }
    
    // 모든 위험한 태그 완전히 제거
    xml = xml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    xml = xml.replace(/<script\s*\/?>/gi, '');
    xml = xml.replace(/<script>/gi, '');
    xml = xml.replace(/<\/script>/gi, '');
    
    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error: any) {
    console.error('Sitemap generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
