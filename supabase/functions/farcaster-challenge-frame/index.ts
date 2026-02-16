import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = "https://k-trendz.com";

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected path: /farcaster-challenge-frame/{challengeId}
  // Or /farcaster-challenge-frame/{challengeId}/answer/{optionIndex}
  
  const challengeId = pathParts[1] || url.searchParams.get('challengeId');
  const action = pathParts[2]; // 'answer' if submitting
  const optionIndex = pathParts[3]; // 0, 1, 2, or 3

  console.log('Request URL:', req.url);
  console.log('Parsed challengeId:', challengeId);
  console.log('Path parts:', pathParts);
  console.log('Query params:', url.searchParams.toString());

  try {
    // Fetch challenge data
    if (!challengeId) {
      console.error('No challengeId found in request');
      return createErrorFrame("Challenge not found", "No challenge ID provided");
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error('Challenge fetch error:', challengeError);
      return createErrorFrame("Challenge not found", "Invalid challenge ID");
    }

    // Check if challenge is active
    const now = new Date();
    const startTime = new Date(challenge.start_time);
    const endTime = new Date(challenge.end_time);

    // test 상태 챌린지는 start_time 전에도 버튼 표시 허용
    const isTestChallenge = challenge.status === 'test';

    if (now < startTime && !isTestChallenge) {
      return createInfoFrame(
        challenge.question,
        `Challenge starts ${startTime.toLocaleDateString()}`,
        challengeId
      );
    }

    if (now > endTime) {
      return createInfoFrame(
        challenge.question,
        "Challenge has ended",
        challengeId,
        true // Show results link
      );
    }

    // Handle POST (button click / answer submission)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Frame POST body:', JSON.stringify(body));

      const { untrustedData } = body;
      const fid = untrustedData?.fid;
      const buttonIndex = untrustedData?.buttonIndex;
      const walletAddress = untrustedData?.address;
      const inputText = untrustedData?.inputText; // 텍스트 입력값

      if (!fid) {
        return createErrorFrame("Authentication Error", "Could not verify Farcaster identity");
      }

      // If this is an answer submission via path
      if (action === 'answer' && optionIndex !== undefined) {
        return await handleAnswerSubmission(
          supabase,
          challenge,
          fid,
          walletAddress,
          parseInt(optionIndex)
        );
      }

      const options = getChallengeOptionTexts(challenge);
      const isOpenEnded = options.length === 0;

      // Open-ended 챌린지: 텍스트 입력으로 답변
      if (isOpenEnded && inputText) {
        return await handleTextAnswerSubmission(
          supabase,
          challenge,
          fid,
          walletAddress,
          inputText.trim()
        );
      }

      // 객관식 챌린지: 버튼 클릭으로 답변
      const numericButtonIndex = Number(buttonIndex);
      if (Number.isFinite(numericButtonIndex) && numericButtonIndex >= 1 && numericButtonIndex <= options.length) {
        return await handleAnswerSubmission(
          supabase,
          challenge,
          fid,
          walletAddress,
          numericButtonIndex - 1 // 0-indexed
        );
      }

      // 버튼은 클릭했지만 입력값이 없는 경우 (Open-ended)
      if (isOpenEnded && !inputText) {
        return createChallengeFrame(challenge); // 다시 입력 화면 표시
      }
    }

    // GET request - show main challenge frame
    return createChallengeFrame(challenge);

  } catch (error: unknown) {
    console.error('Frame error:', error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return createErrorFrame("Error", message);
  }
});

function getChallengeOptionTexts(challenge: any): string[] {
  // challenges.options 컬럼은 과거에는 string[]였고, 현재는 { items: [...] } 구조(Json)도 사용함
  const raw = challenge?.options;

  if (!raw) return [];

  // 1) 이미 배열인 경우
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter(Boolean);
  }

  // 2) 문자열(JSON)인 경우
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      // 재귀적으로 한 번 더 처리
      return getChallengeOptionTexts({ options: parsed });
    } catch {
      return [];
    }
  }

  // 3) 객체 구조인 경우: { items: [{ text, label, ... }, ...] }
  if (typeof raw === 'object') {
    const maybeItems = (raw as any).items;
    if (Array.isArray(maybeItems)) {
      return maybeItems
        .map((item: any) => item?.text ?? item?.label ?? '')
        .map((v: any) => String(v))
        .filter(Boolean);
    }

    // 기타 케이스: { options: [...] }
    const maybeOptions = (raw as any).options;
    if (Array.isArray(maybeOptions)) {
      return maybeOptions.map((v: any) => String(v)).filter(Boolean);
    }
  }

  return [];
}

async function handleAnswerSubmission(
  supabase: any,
  challenge: any,
  fid: number,
  walletAddress: string | null,
  optionIndex: number
) {
  const options = getChallengeOptionTexts(challenge);
  const selectedAnswer = options[optionIndex];

  if (!selectedAnswer) {
    return createErrorFrame("Invalid Answer", "Please select a valid option");
  }

  return await recordParticipation(supabase, challenge, fid, walletAddress, selectedAnswer);
}

async function handleTextAnswerSubmission(
  supabase: any,
  challenge: any,
  fid: number,
  walletAddress: string | null,
  inputText: string
) {
  if (!inputText || inputText.length === 0) {
    return createErrorFrame("Invalid Answer", "Please enter your answer");
  }

  // 최대 100자로 제한
  const answer = inputText.substring(0, 100).trim();
  
  return await recordParticipation(supabase, challenge, fid, walletAddress, answer);
}

async function recordParticipation(
  supabase: any,
  challenge: any,
  fid: number,
  walletAddress: string | null,
  answer: string
) {
  // Get or create external wallet user
  let externalWalletId: string;
  
  // First check if user exists by FID
  const { data: existingUser } = await supabase
    .from('external_wallet_users')
    .select('id, wallet_address')
    .eq('fid', fid)
    .eq('source', 'farcaster')
    .maybeSingle();

  if (existingUser) {
    externalWalletId = existingUser.id;
    
    // Update wallet address if changed
    if (walletAddress && existingUser.wallet_address !== walletAddress) {
      await supabase
        .from('external_wallet_users')
        .update({ wallet_address: walletAddress, updated_at: new Date().toISOString() })
        .eq('id', existingUser.id);
    }
  } else {
    // Create new external wallet user
    const { data: newUser, error: createError } = await supabase
      .from('external_wallet_users')
      .insert({
        wallet_address: walletAddress || `farcaster:${fid}`, // Fallback if no wallet
        source: 'farcaster',
        fid: fid,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Create user error:', createError);
      return createErrorFrame("Error", "Could not create user record");
    }
    externalWalletId = newUser.id;
  }

  // Check if already participated
  const { data: existingParticipation } = await supabase
    .from('external_challenge_participations')
    .select('id, answer')
    .eq('external_wallet_id', externalWalletId)
    .eq('challenge_id', challenge.id)
    .maybeSingle();

  if (existingParticipation) {
    return createSuccessFrame(
      challenge,
      existingParticipation.answer,
      true // Already participated
    );
  }

  // Check if this wallet is already a K-Trendz user (to prevent double participation)
  if (walletAddress) {
    const { data: linkedWallet } = await supabase
      .from('wallet_addresses')
      .select('user_id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (linkedWallet) {
      // Check if they already participated via K-Trendz
      const { data: ktrendzParticipation } = await supabase
        .from('challenge_participations')
        .select('id')
        .eq('user_id', linkedWallet.user_id)
        .eq('challenge_id', challenge.id)
        .maybeSingle();

      if (ktrendzParticipation) {
        return createInfoFrame(
          "Already Participated",
          "You already entered this challenge on K-Trendz!",
          challenge.id
        );
      }
    }
  }

  // Record participation
  const { error: participationError } = await supabase
    .from('external_challenge_participations')
    .insert({
      external_wallet_id: externalWalletId,
      challenge_id: challenge.id,
      answer: answer,
    });

  if (participationError) {
    console.error('Participation error:', participationError);
    return createErrorFrame("Error", "Could not record your answer");
  }

  return createSuccessFrame(challenge, answer, false);
}

function createChallengeFrame(challenge: any) {
  // 이미지 우선순위: 1. image_url, 2. YouTube 썸네일, 3. 기본 이미지
  let ogImageUrl = challenge.image_url;
  if (!ogImageUrl || ogImageUrl === `${SITE_URL}/images/challenges-og.jpg`) {
    const challengeOptions = challenge.options;
    if (challengeOptions?.type === 'youtube' && challengeOptions?.youtube_video_id) {
      // YouTube 고화질 썸네일 사용
      ogImageUrl = `https://img.youtube.com/vi/${challengeOptions.youtube_video_id}/maxresdefault.jpg`;
    }
  }
  if (!ogImageUrl) {
    ogImageUrl = `${SITE_URL}/images/challenges-og.jpg`;
  }

  // Mini App embed용 이미지 - challenges-og.jpg 사용
  const miniappImageUrl = `${SITE_URL}/images/challenges-og.jpg`;

  const prizeText = challenge.total_prize_usdc > 0 ? `$${challenge.total_prize_usdc} USDC` : 'TBD';

  // Mini App v2 실행 URL
  const miniAppUrl = `${SITE_URL}/farcaster-app/${challenge.id}`;

  // Base Mini App embed 스키마 (version: "next", type: "launch_miniapp")
  const miniappJson = JSON.stringify({
    version: "next",
    imageUrl: miniappImageUrl,
    button: {
      title: "Play Challenge",
      action: {
        type: "launch_miniapp",
        name: "K-Trendz",
        url: miniAppUrl,
        splashImageUrl: `${SITE_URL}/farcaster-day1-hero.jpg`,
        splashBackgroundColor: "#c13400",
      },
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapeHtml(challenge.question.substring(0, 60))}" />
  <meta property="og:description" content="Prize Pool: ${prizeText} | K-Trendz Challenge" />
  <meta property="og:image" content="${ogImageUrl}" />

  <meta name="fc:miniapp" content='${miniappJson}' />
  <meta property="fc:miniapp" content='${miniappJson}' />
</head>
<body>
  <h1>${escapeHtml(challenge.question)}</h1>
  <p>Prize Pool: ${prizeText}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
    })
  });
}

function createSuccessFrame(challenge: any, answer: string, alreadyParticipated: boolean) {
  const title = alreadyParticipated 
    ? "Already Entered!" 
    : "🎉 Entry Submitted!";
  
  const message = alreadyParticipated
    ? `You already picked: ${answer}`
    : `Your answer: ${answer}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title}" />
  <meta property="og:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Check Status on K-Trendz" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${SITE_URL}/challenges" />
</head>
<body>
  <h1>${title}</h1>
  <p>${escapeHtml(message)}</p>
  <p>Connect your wallet on K-Trendz to check results!</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
    })
  });
}

function createInfoFrame(title: string, message: string, challengeId: string, showResults = false) {
  const buttonContent = showResults ? "View Results" : "Visit K-Trendz";
  const buttonTarget = showResults 
    ? `${SITE_URL}/challenges?id=${challengeId}` 
    : `${SITE_URL}/challenges`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="${buttonContent}" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${buttonTarget}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
    })
  });
}

function createErrorFrame(title: string, message: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${SITE_URL}/images/challenges-og.jpg" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Try Again" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${SITE_URL}/challenges" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
    })
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
