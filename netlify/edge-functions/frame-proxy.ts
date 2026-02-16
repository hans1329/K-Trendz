import type { Context } from "https://edge.netlify.com";

const SUPABASE_FUNCTIONS_URL = "https://jguylowswwgjvotdcsfj.supabase.co/functions/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export default async function handler(request: Request, _context: Context) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // /api/farcaster-*-frame -> /farcaster-*-frame (Supabase edge function)
  const isChallengeFrame = pathname.startsWith("/api/farcaster-challenge-frame");
  const isPioneerFrame = pathname.startsWith("/api/farcaster-pioneer-frame");

  if (!isChallengeFrame && !isPioneerFrame) {
    return new Response("Not Found", { status: 404 });
  }

  const base = isChallengeFrame
    ? "/farcaster-challenge-frame"
    : "/farcaster-pioneer-frame";

  const restPath = isChallengeFrame
    ? pathname.replace("/api/farcaster-challenge-frame", "")
    : pathname.replace("/api/farcaster-pioneer-frame", "");

  const targetUrl = `${SUPABASE_FUNCTIONS_URL}${base}${restPath}${url.search}`;

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      // Farcaster/OG crawlers are picky; HTML로 강제해서 메타 태그를 안정적으로 파싱하게 만든다.
      Accept: "text/html,*/*",
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      "User-Agent": request.headers.get("User-Agent") || "",
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  });

  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      // Supabase Edge가 text/plain으로 내려도 Netlify에서 강제로 HTML로 바꿔준다.
      "Content-Type": "text/html; charset=utf-8",
      // Frame/OG 캐시로 버튼/이미지 업데이트가 안 보이는 문제 방지
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      "X-Frame-Proxy": "netlify",
    },
  });
}
