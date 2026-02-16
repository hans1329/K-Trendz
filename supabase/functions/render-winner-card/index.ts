import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const challengeId = url.searchParams.get('challengeId');
    const rank = url.searchParams.get('rank') || '1';
    const prize = url.searchParams.get('prize') || '0';
    const username = url.searchParams.get('username') || 'Winner';

    console.log('Render Winner Card:', { challengeId, rank, prize, username });

    if (!challengeId) {
      return new Response('Challenge ID required', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Supabase 클라이언트
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 챌린지 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('question, image_url, wiki_entry_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error('Challenge fetch error:', challengeError);
      return new Response('Challenge not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // 위너 카드 이미지 URL - 정적 이미지 사용
    const winnerCardImageUrl = `https://k-trendz.com/images/winner-og-image.jpg`;
    
    // 질문 텍스트 (100자로 자르기)
    const questionText = challenge.question.length > 100 
      ? challenge.question.substring(0, 100) + '...' 
      : challenge.question;

    // 등수 텍스트
    const rankNum = parseInt(rank);
    let rankText = `#${rank} Winner`;
    if (rankNum === 1) rankText = '🥇 1st Place';
    else if (rankNum === 2) rankText = '🥈 2nd Place';
    else if (rankNum === 3) rankText = '🥉 3rd Place';

    // HTML 생성
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏆 @${username} won $${prize} on KTRENDZ Challenge!</title>
  
  <!-- SEO Meta Tags -->
  <meta name="description" content="${rankText} - Won $${prize} USDC on KTRENDZ Challenge! ${questionText}">
  <meta name="robots" content="index, follow">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://k-trendz.com/winner/${challengeId}?rank=${rank}&prize=${prize}&username=${encodeURIComponent(username)}">
  <meta property="og:title" content="🏆 @${username} won $${prize} on KTRENDZ Challenge!">
  <meta property="og:description" content="${rankText} - Join KTRENDZ and win prizes too!">
  <meta property="og:image" content="${winnerCardImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="KTRENDZ">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://k-trendz.com/winner/${challengeId}?rank=${rank}&prize=${prize}&username=${encodeURIComponent(username)}">
  <meta name="twitter:title" content="🏆 @${username} won $${prize} on KTRENDZ Challenge!">
  <meta name="twitter:description" content="${rankText} - Join KTRENDZ and win prizes too!">
  <meta name="twitter:image" content="${winnerCardImageUrl}">
  
  <!-- Redirect to challenges page after 0 seconds for bots, or show content for real users -->
  <meta http-equiv="refresh" content="0;url=https://k-trendz.com/challenges?highlight=${challengeId}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 500px;
    }
    .trophy { font-size: 80px; }
    .title { font-size: 24px; color: #f59e0b; margin: 20px 0; }
    .prize { font-size: 48px; color: #22c55e; font-weight: bold; }
    .username { font-size: 20px; opacity: 0.8; margin-top: 20px; }
    .cta {
      margin-top: 30px;
      padding: 15px 30px;
      background: linear-gradient(to right, #f59e0b, #ef4444);
      border: none;
      border-radius: 50px;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .loading { margin-top: 20px; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="trophy">🏆</div>
    <div class="title">CHALLENGE WINNER</div>
    <div class="prize">$${prize}</div>
    <div class="username">@${username}</div>
    <a href="https://k-trendz.com/challenges" class="cta">Join KTRENDZ & Win Prizes!</a>
    <p class="loading">Redirecting to KTRENDZ...</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐싱
      },
    });

  } catch (error: any) {
    console.error('Error rendering winner card:', error);
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
