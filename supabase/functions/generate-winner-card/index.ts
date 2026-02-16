import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 세련된 다크 테마 SVG 위너 카드 생성
function generateWinnerCardSVG(
  rank: number,
  prize: number,
  username: string
): string {
  let rankText = `#${rank}`;
  let accentColor = '#c13400';
  
  if (rank === 1) { 
    rankText = '1ST'; 
    accentColor = '#c13400';
  } else if (rank === 2) { 
    rankText = '2ND'; 
    accentColor = '#94a3b8';
  } else if (rank === 3) { 
    rankText = '3RD'; 
    accentColor = '#d97706';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 다크 배경 -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#09090b"/>
      <stop offset="100%" style="stop-color:#18181b"/>
    </linearGradient>
    
    <!-- 카드 배경 -->
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1c1c1f"/>
      <stop offset="100%" style="stop-color:#111113"/>
    </linearGradient>
    
    <!-- 오렌지 악센트 -->
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#c13400"/>
      <stop offset="100%" style="stop-color:#ea580c"/>
    </linearGradient>
    
    <!-- 상금 그라데이션 -->
    <linearGradient id="prizeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff"/>
      <stop offset="100%" style="stop-color:#a1a1aa"/>
    </linearGradient>
    
    <!-- 미묘한 글로우 -->
    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="40" flood-color="rgba(193,52,0,0.15)"/>
    </filter>
    
    <filter id="textGlow">
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="rgba(255,255,255,0.1)"/>
    </filter>
  </defs>
  
  <!-- 배경 -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- 배경 장식 - 미묘한 원 -->
  <circle cx="900" cy="100" r="400" fill="rgba(193,52,0,0.03)"/>
  <circle cx="300" cy="530" r="300" fill="rgba(193,52,0,0.02)"/>
  
  <!-- 메인 카드 -->
  <rect x="160" y="65" width="880" height="500" rx="16" fill="url(#cardBg)" filter="url(#subtleGlow)"/>
  <rect x="160" y="65" width="880" height="500" rx="16" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  
  <!-- 상단 악센트 라인 -->
  <rect x="160" y="65" width="880" height="3" fill="url(#accentGradient)"/>
  
  <!-- KTRENDZ 로고 -->
  <text x="600" y="130" text-anchor="middle" font-size="13" font-weight="500" fill="rgba(255,255,255,0.4)" font-family="system-ui, -apple-system, sans-serif" letter-spacing="4">KTRENDZ CHALLENGE</text>
  
  <!-- Winner 타이틀 -->
  <text x="600" y="200" text-anchor="middle" font-size="14" font-weight="600" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" letter-spacing="6">WINNER</text>
  
  <!-- 등수 -->
  <text x="600" y="280" text-anchor="middle" font-size="80" font-weight="800" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2" filter="url(#textGlow)">${rankText}</text>
  
  <!-- 구분선 -->
  <line x1="500" y1="310" x2="700" y2="310" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  
  <!-- 상금 -->
  <text x="600" y="400" text-anchor="middle" font-size="64" font-weight="700" fill="url(#prizeGradient)" font-family="system-ui, -apple-system, sans-serif">$${prize.toFixed(2)}</text>
  
  <!-- USDC 라벨 -->
  <text x="600" y="435" text-anchor="middle" font-size="14" font-weight="500" fill="rgba(255,255,255,0.4)" font-family="system-ui, -apple-system, sans-serif" letter-spacing="2">USDC</text>
  
  <!-- 유저네임 -->
  <rect x="480" y="480" width="240" height="44" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="600" y="509" text-anchor="middle" font-size="18" font-weight="500" fill="rgba(255,255,255,0.8)" font-family="system-ui, -apple-system, sans-serif">@${username}</text>
  
  <!-- 하단 브랜딩 -->
  <text x="600" y="595" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.25)" font-family="system-ui, -apple-system, sans-serif">k-trendz.com</text>
</svg>`;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const challengeId = url.searchParams.get('challengeId');
    const rank = parseInt(url.searchParams.get('rank') || '1');
    const prize = parseFloat(url.searchParams.get('prize') || '0');
    const username = url.searchParams.get('username') || 'Winner';

    console.log('Generate Winner Card SVG:', { challengeId, rank, prize, username });

    if (!challengeId) {
      return new Response('Challenge ID required', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // SVG 생성
    const svg = generateWinnerCardSVG(rank, prize, username);

    return new Response(svg, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // 24시간 캐싱
      },
    });

  } catch (error: any) {
    console.error('Error generating winner card:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
