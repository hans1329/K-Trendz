import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

// YouTube 썸네일 추출 함수
function getYoutubeThumbnail(url: string): string | null {
  if (!url) return null;
  
  // YouTube URL 패턴들
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    }
  }
  
  return null;
}

// 이미지 URL 결정
function getImageUrl(challenge: any): string {
  // 1. 챌린지 자체 이미지
  if (challenge.image_url) {
    const ytThumb = getYoutubeThumbnail(challenge.image_url);
    if (ytThumb) return ytThumb;
    return challenge.image_url;
  }
  
  // 2. 연결된 위키 엔트리 이미지
  if (challenge.wiki_entry?.image_url) {
    return challenge.wiki_entry.image_url;
  }
  
  // 3. 기본 이미지
  return "https://k-trendz.com/images/challenges-og.jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 현재 활성 챌린지 조회 (가장 최근 것)
    const { data: challenge, error } = await supabase
      .from("challenges")
      .select(`
        *,
        wiki_entry:wiki_entries(id, title, image_url, slug)
      `)
      .in("status", ["active", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching challenge:", error);
      throw error;
    }

    // 기본값 설정
    let title = "K-Pop Prediction Challenges | KTrendz";
    let description = "Predict K-Pop trends and win USDC prizes! Join weekly prediction challenges on KTrendz.";
    let imageUrl = "https://k-trendz.com/images/challenges-og.jpg";

    if (challenge) {
      // 질문에서 ___ 부분을 "???" 로 대체하거나 일부만 표시
      const questionPreview = challenge.question.length > 60 
        ? challenge.question.substring(0, 57) + "..." 
        : challenge.question;
      
      title = `🎯 ${questionPreview} | KTrendz Challenge`;
      description = `💰 $${challenge.total_prize_usdc} USDC Prize Pool! ${challenge.winner_count} winners. Predict now on KTrendz!`;
      imageUrl = getImageUrl(challenge);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="https://k-trendz.com/challenges" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://k-trendz.com/challenges" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="KTrendz" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@KTRNZ2025" />
  <meta name="twitter:creator" content="@KTRNZ2025" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="K-Pop Prediction Challenge" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="https://k-trendz.com/challenges">Visit KTrendz Challenges</a>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in render-challenges:", error);
    
    // 에러 시 기본 메타 반환
    const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K-Pop Prediction Challenges | KTrendz</title>
  <meta name="description" content="Predict K-Pop trends and win USDC prizes! Join weekly prediction challenges on KTrendz." />
  <meta property="og:image" content="https://k-trendz.com/images/challenges-og.jpg" />
</head>
<body>
  <h1>K-Pop Prediction Challenges</h1>
</body>
</html>`;
    
    return new Response(fallbackHtml, {
      status: 200,
      headers: corsHeaders,
    });
  }
});
