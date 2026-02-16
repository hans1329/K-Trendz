import type { Context } from "https://edge.netlify.com";

const SUPABASE_FUNCTIONS_URL = "https://jguylowswwgjvotdcsfj.supabase.co/functions/v1";

// 봇 User-Agent 패턴
const BOT_PATTERNS = [
  'bot',
  'crawler',
  'spider',
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  // 카카오톡/텔레그램 "프리뷰 크롤러"만 봇으로 분류 (인앱 브라우저는 제외)
  'kakaotalk-scrap',
  'telegrambot',
  'naverbot',
  'daumoa',
  'slackbot',
  'discordbot',
  'pinterest',
  'tumblr',
  'petalbot',
  'semrush',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'applebot',
  'seznambot',
  'yeti',
  'ia_archiver',
  'archive.org_bot',
  'meta-externalagent',
  // Twitter/X 새로운 크롤러 UA 추가
  'twitterbot',
  'x.com',
  'twitter.com',
  // Farcaster/Warpcast 크롤러
  'farcaster',
  'warpcast',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

export default async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const userAgent = request.headers.get('User-Agent') || '';
  const isBotRequest = isBot(userAgent);

  // 일부 인앱 브라우저는 헤더가 불완전해서 봇으로 오인될 수 있음
  // spa=1 쿼리는 강제로 SPA(React)로 통과시킨다.
  const forceSpa = url.searchParams.get('spa') === '1';
  if (forceSpa) {
    console.log('SSR Proxy: Forced SPA via query param', { pathname });
    return context.next();
  }

  // SSR이 필요한 경로들
  const isWinnerPath = pathname.startsWith('/winner/');
  const isPostPath = pathname.startsWith('/post/') || pathname.startsWith('/p/');
  const isWikiPath = pathname.startsWith('/k/') || pathname.startsWith('/w/');
  const isChallengesPath = pathname === '/challenges';
  const isMiniAppPath = pathname === '/miniapp';
  const isHomePath = pathname === '/' || pathname === '';
  const needsSSR = isWinnerPath || isPostPath || isWikiPath || isChallengesPath || isMiniAppPath || isHomePath;

  // 봇이 아니면 항상 SPA로 통과
  if (!isBotRequest) {
    console.log('SSR Proxy: Not a bot, passing to SPA', { pathname, userAgent: userAgent.substring(0, 80) });
    return context.next();
  }

  // 봇인데 SSR이 필요없는 경로면 SPA로 통과
  if (!needsSSR) {
    console.log('SSR Proxy: Bot but path does not need SSR', { pathname });
    return context.next();
  }

  // 봇 요청이고 SSR이 필요한 경로 → SSR 제공
  // (Sec-Fetch 헤더와 관계없이 봇에게는 항상 메타태그 제공)
  console.log('SSR Proxy: Bot detected, serving SSR', {
    pathname,
    userAgent: userAgent.substring(0, 100),
  });
  
  let targetUrl: string;
  let entryId: string;
  
  // /k/:id, /w/:id → render-wiki
  if (pathname.startsWith('/k/') || pathname.startsWith('/w/')) {
    entryId = pathname.split('/')[2];
    if (!entryId) {
      return context.next();
    }
    targetUrl = `${SUPABASE_FUNCTIONS_URL}/render-wiki?id=${entryId}`;
  }
  // /post/:id, /p/:id → render-post
  else if (pathname.startsWith('/post/') || pathname.startsWith('/p/')) {
    entryId = pathname.split('/')[2];
    if (!entryId) {
      return context.next();
    }
    targetUrl = `${SUPABASE_FUNCTIONS_URL}/render-post?id=${entryId}`;
  }
  // /winner/:challengeId → render-winner-card (위너 카드 공유 페이지)
  else if (pathname.startsWith('/winner/')) {
    const challengeId = pathname.split('/')[2];
    if (!challengeId) {
      return context.next();
    }
    // URL 파라미터 전달
    const rank = url.searchParams.get('rank') || '1';
    const prize = url.searchParams.get('prize') || '0';
    const username = url.searchParams.get('username') || 'Winner';
    targetUrl = `${SUPABASE_FUNCTIONS_URL}/render-winner-card?challengeId=${challengeId}&rank=${rank}&prize=${prize}&username=${encodeURIComponent(username)}`;
    entryId = challengeId;
  }
  // /challenges → 동적 OG 메타 태그 (현재 챌린지 이미지 포함)
  else if (pathname === '/challenges') {
    targetUrl = `${SUPABASE_FUNCTIONS_URL}/render-challenges`;
    entryId = 'challenges';
  }
  // /miniapp → Farcaster Mini App embed 메타 태그 (fc:frame)
  else if (pathname === '/miniapp') {
    const frameData = JSON.stringify({
      version: "next",
      imageUrl: "https://k-trendz.com/images/miniapp-hub-og.jpg",
      button: {
        title: "Open K-Trendz",
        action: {
          type: "launch_miniapp",
          name: "K-Trendz",
          url: "https://k-trendz.com/miniapp",
          splashImageUrl: "https://k-trendz.com/favicon.png",
          splashBackgroundColor: "#c13400"
        }
      }
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K-Trendz Quiz and Shop</title>
  <meta name="description" content="Win USDC in K-Pop Quiz Show and support your favorite artists with digital lightsticks." />
  <link rel="canonical" href="https://k-trendz.com/miniapp" />
  
  <!-- Farcaster Mini App Meta Tags -->
  <meta name="fc:miniapp" content='${frameData}' />
  <meta property="fc:miniapp" content='${frameData}' />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://k-trendz.com/miniapp" />
  <meta property="og:title" content="K-Trendz Quiz and Shop" />
  <meta property="og:description" content="Win USDC in K-Pop Quiz Show and support your favorite artists with digital lightsticks." />
  <meta property="og:image" content="https://k-trendz.com/images/miniapp-hub-og.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="640" />
  <meta property="og:site_name" content="K-Trendz" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="K-Trendz Quiz and Shop" />
  <meta name="twitter:description" content="Win USDC in K-Pop Quiz Show and support your favorite artists with digital lightsticks." />
  <meta name="twitter:image" content="https://k-trendz.com/images/miniapp-hub-og.jpg" />
</head>
<body>
  <h1>K-Trendz Quiz and Shop</h1>
  <p>Win USDC in K-Pop Quiz Show and support your favorite artists with digital lightsticks.</p>
  <a href="https://k-trendz.com/miniapp">Open K-Trendz</a>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
  // 메인페이지 → 정적 OG 메타 태그 반환 (봇 전용)
  else if (pathname === '/' || pathname === '') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KTRENDZ: Transparent K-Pop Artist Support Platform</title>
  <meta name="description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
  <meta name="keywords" content="kpop artist support, fan support platform, kpop donations, transparent donations, on-chain donations, fan governance, kpop community, lightstick tokens, artist fund, korean culture, k-pop, kpop schedule, kpop news, korean drama, kdrama, korean entertainment, hallyu, k-culture, kpop idols, kpop groups, kpop wiki, korean celebrities, kpop fan community" />
  <link rel="canonical" href="https://k-trendz.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://k-trendz.com" />
  <meta property="og:title" content="KTRENDZ: Transparent K-Pop Artist Support Platform" />
  <meta property="og:description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
  <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1764697358329-og_ktrendz.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="KTRENDZ" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@KTRENDZ" />
  <meta name="twitter:creator" content="@KTRENDZ" />
  <meta name="twitter:title" content="KTRENDZ: Transparent K-Pop Artist Support Platform" />
  <meta name="twitter:description" content="K-Pop artist support platform with transparent on-chain donations and fan governance." />
  <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/wXvsj6eZbYaEQQgUsiT21k2YrkX2/social-images/social-1764697358329-og_ktrendz.jpg" />
  <meta name="twitter:image:alt" content="KTRENDZ - K-Pop Community Platform" />
</head>
<body>
  <h1>KTRENDZ: Transparent K-Pop Artist Support Platform</h1>
  <p>K-Pop artist support platform with transparent on-chain donations and fan governance.</p>
  <a href="https://k-trendz.com">Visit KTRENDZ</a>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } else {
    // Fallback: continue to origin
    return context.next();
  }
  
  console.log('SSR Proxy: Bot detected, proxying to SSR', { pathname, entryId, userAgent, targetUrl });
  
  // Proxy request to Supabase Edge Function
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': userAgent,
    },
  });
  
  // Get response body
  const body = await response.text();
  
  console.log('SSR Proxy response:', { status: response.status, bodyLength: body.length });
  
  // 챌린지 페이지는 캐시하지 않음 (최신 챌린지 OG 이미지 보장)
  const noCache = isChallengesPath;
  
  // Return with corrected Content-Type header
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': noCache
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=300, s-maxage=600',
      // UA별 SSR 여부가 달라 캐시 오염 방지
      'Vary': 'User-Agent, Sec-Fetch-User',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Path configuration - handled in netlify.toml
// Do NOT export config here to avoid conflicts with netlify.toml
